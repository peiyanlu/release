import { intro, select, tasks } from '@clack/prompts'
import {
  bumpPackageVersion,
  type CliOptions,
  coloredChangeset,
  eol,
  getGithubReleaseUrl,
  getLog,
  getPackageInfo,
  getPackageUrl,
  getStatus,
  readJsonFile,
  resolveChangelogRange,
  runGit,
} from '@peiyanlu/cli-utils'
import { join } from 'node:path'
import { publint } from 'publint'
import { formatMessage } from 'publint/utils'
import { inc, ReleaseType } from 'semver'
import { mergeConfig, resolveConfig } from './config.js'
import { createDefaultConfig, createDefaultContext } from './defaults.js'
import { generateChangelog } from './git/changelog.js'
import { commitAndTag, gitCheck, gitRollback } from './git/commit.js'
import { runGitPrompts } from './git/prompts.js'
import { runGithubPrompts } from './github/prompts.js'
import { createRelease } from './github/release.js'
import { MSG } from './messages.js'
import { runNpmOptPrompts, runNpmPublishPrompts } from './npm/prompts.js'
import { isOtpError, npmCheck, publishNpm } from './npm/publish.js'
import { abortOnError, abortSinglePrompt, abortTask, taskEnd } from './prompts.js'
import { ReleaseConfig, ReleaseContext, ResolvedConfig } from './types.js'
import { diff, formatTemplate, info, msg, question, runLifeCycleHook, success } from './utils.js'
import { getCIVersion, isPreRelease, parseVersion } from './version/bump.js'
import { runVersionPrompts } from './version/prompts.js'


export class Action {
  public async handle(cmdArgs: string, options: CliOptions) {
    const { version: cVersion, name: cName } = readJsonFile(join(__dirname, '../package.json'))
    
    const { otp, package: defPkg, ...others } = options
    const { showChangelog, showRelease, ci, dryRun } = Object.fromEntries(
      Object
        .entries(others)
        .map(([ k, v ]) => [ k, Boolean(v) ]),
    )
    
    process.env['dryRun'] = String(dryRun)
    
    
    const { configPath, config: local } = await resolveConfig<ReleaseConfig>(process.cwd())
    const defaultConfig = createDefaultConfig(ci ? true : undefined)
    const config: ResolvedConfig = mergeConfig<ResolvedConfig>(defaultConfig, local)
    
    
    info(MSG.INFO.TOOL(cName, cVersion))
    info(MSG.INFO.CONFIG(configPath))
    
    console.log()
    intro(MSG.INTRO(dryRun))
    
    const { isMonorepo, packages, getPkgDir } = config
    
    if (isMonorepo) {
      if (ci) {
        if (!defPkg) {
          abortTask(MSG.ABORT.MONOREPO_CI_NO_PACKAGE)
        }
      } else {
        if (packages.length < 1) {
          abortTask(MSG.ABORT.MONOREPO_NO_PACKAGES)
        }
      }
    }
    
    const selectPackage = async () => {
      const pkg = await select({
        message: question(MSG.PROMPT.SELECT_PACKAGE, 'package'),
        options: packages.map(pkg => ({ label: pkg, value: pkg })),
      }) as string
      abortSinglePrompt(pkg)
      return pkg
    }
    const selectedPkg =
      !isMonorepo
        ? ''
        : ci
          ? defPkg as string
          : packages.length === 1
            ? packages[0]
            : (await selectPackage())
    
    
    const { pkg, pkgDir } = getPackageInfo(selectedPkg, getPkgDir)
    const { version: pkgVersion, private: pkgPrivate = false, name: pkgName, publishConfig = {} } = pkg
    
    const nextVersion = inc(pkgVersion, cmdArgs as ReleaseType) ?? ''
    
    const defaultContext = createDefaultContext()
    const ctx: ReleaseContext = mergeConfig<ReleaseContext>(
      defaultContext,
      {
        selectedPkg,
        configFileExists: Object.keys(local).length > 0,
        dryRun,
        showRelease,
        showChangelog,
        npm: { otp: String(otp) },
        increment: cmdArgs,
        isIncrement: true,
        isCI: [ ci, showChangelog, showRelease, process.env.GITHUB_ACTIONS, process.env.CI ].some(k => Boolean(k)),
        pkg: {
          name: pkgName,
          isPrivate: pkgPrivate,
          fromPreRelease: isPreRelease(pkgVersion),
          current: pkgVersion,
          next: nextVersion,
          toPreRelease: false,
          publishConfig: { ...publishConfig },
        },
        noNpm: pkgPrivate,
      },
    )
    
    const { messages } = await publint({ pkgDir })
    for (const message of messages) {
      const formated = formatMessage(message, pkg)
      formated && msg('PKG', formated)
    }
    
    
    // 1️⃣ 预检查阶段
    await this.checkTask(ctx, config)
    
    // 2️⃣ 版本升级阶段
    await this.bumpTask(ctx, config)
    
    // 3️⃣ 生成 Changelog
    await this.changelogTask(ctx, config)
    
    // 4️⃣ Git 操作阶段
    await this.gitTask(ctx, config)
    
    // 5️⃣ 发布 npm
    await this.npmTask(ctx, config)
    
    // 6️⃣ GitHub 操作
    await this.githubTask(ctx, config)
    
    
    if (dryRun) gitRollback(ctx)
    
    taskEnd(MSG.OUTRO(dryRun))
  }
  
  async checkTask(ctx: ReleaseContext, config: ResolvedConfig) {
    const { noNpm, dryRun } = ctx
    await tasks([
      {
        title: MSG.CHECK.GIT.CHECKING,
        task: async () => {
          await gitCheck(ctx, config)
          const { git: { remoteName, remoteUrl } } = ctx
          
          return success(MSG.CHECK.GIT.CHECKED(remoteName, remoteUrl), dryRun)
        },
      },
      {
        title: MSG.CHECK.NPM.CHECKING,
        task: async () => {
          const msg = await npmCheck(ctx, config)
          const { pkg: { publishConfig: { registry } } } = ctx
          
          return success(MSG.CHECK.NPM.CHECKED(registry, msg), dryRun)
        },
        enabled: !noNpm,
      },
    ]).catch(abortOnError)
  }
  
  async bumpTask(ctx: ReleaseContext, config: ResolvedConfig) {
    const { pkg: { current }, dryRun, isCI, showRelease, showChangelog, selectedPkg } = ctx
    const { hooks, getPkgDir } = config
    
    const need = (ctx: ReleaseContext) => {
      const { pkg: { next }, isIncrement } = ctx
      return !next && isIncrement
    }
    
    if (need(ctx)) {
      const ciVersion = isCI && getCIVersion(current)
      const next = ciVersion || (await runVersionPrompts(ctx, config)).next
      const parsed = parseVersion(next)
      Object.assign(ctx.pkg, { ...parsed })
    }
    
    const { pkg: { next }, isIncrement } = ctx
    
    if (showRelease) {
      taskEnd(MSG.LOG.SHOW_VERSION(next))
    }
    
    await runLifeCycleHook(hooks, 'before:bump', dryRun)
    await tasks([
      {
        title: MSG.TASK.VERSION.START,
        task: async () => {
          await bumpPackageVersion(next, [], getPkgDir(selectedPkg))
          await formatTemplate(ctx, config)
          
          const to = `(${ current }...${ diff(current, next) })`
          return success(MSG.TASK.VERSION.END(to), dryRun)
        },
      },
    ]).catch((err) => abortOnError(err, ctx))
    await runLifeCycleHook(hooks, 'after:bump', dryRun)
    
    // 打印 Changelog
    const { from, to } = await resolveChangelogRange(isIncrement)
    const logStr = await getLog(from, to, getPkgDir(selectedPkg))
    if (logStr) {
      msg('GIT', `Changelog:${ eol(2) }` + logStr)
      if (showChangelog) taskEnd(MSG.LOG.SHOW_CHANGELOG)
    } else {
      msg('GIT', MSG.LOG.CHANGELOG_EMPTY)
    }
  }
  
  async changelogTask(ctx: ReleaseContext, config: ResolvedConfig) {
    const { isIncrement, dryRun, selectedPkg } = ctx
    const { getPkgDir, changelogTagPrefix } = config
    
    await tasks([
      {
        title: MSG.TASK.CHANGELOG.START,
        task: async () => {
          const changelog = await generateChangelog({
            getPkgDir: () => getPkgDir(selectedPkg),
            tagPrefix: changelogTagPrefix?.(selectedPkg),
          })
          await runGit([ 'add', `${ getPkgDir(selectedPkg) }/CHANGELOG.md` ])
          
          Object.assign(ctx.github, { changelog })
          return success(MSG.TASK.CHANGELOG.END, dryRun)
        },
        enabled: isIncrement,
      },
    ]).catch((err) => abortOnError(err, ctx))
    
    // 打印 Changes
    const changeset = await getStatus()
    if (changeset) {
      msg('GIT', `Changes:${ eol(2) }` + coloredChangeset(changeset))
    } else {
      msg('GIT', MSG.LOG.CHANGES_EMPTY)
    }
  }
  
  async gitTask(ctx: ReleaseContext, config: ResolvedConfig) {
    const { noGit, dryRun } = ctx
    const { hooks } = config
    
    if (noGit) return
    
    await runGitPrompts(ctx, config)
    
    await runLifeCycleHook(hooks, 'before:push', dryRun)
    await tasks([
      {
        title: MSG.TASK.GIT.START,
        task: async () => {
          await commitAndTag(ctx, config)
          return success(MSG.TASK.GIT.END, dryRun)
        },
      },
    ]).catch((err) => abortOnError(err, ctx))
    await runLifeCycleHook(hooks, 'after:push', dryRun)
  }
  
  async npmTask(ctx: ReleaseContext, config: ResolvedConfig) {
    const { noNpm, dryRun, isCI, pkg: { name, next } } = ctx
    const { hooks } = config
    
    if (noNpm) return
    
    await runNpmPublishPrompts(ctx, config)
    
    await runLifeCycleHook(hooks, 'before:publish', dryRun)
    await tasks([
      {
        title: MSG.TASK.NPM.START,
        task: async () => {
          await publishNpm(ctx, config)
            .catch(async err => {
              if (isOtpError(err) && !isCI) {
                await runNpmOptPrompts(ctx, config)
                await publishNpm(ctx, config)
              } else {
                throw err
              }
            })
          
          const url = getPackageUrl(name, next)
          return success(MSG.TASK.NPM.END(url), dryRun)
        },
      },
    ]).catch((err) => abortOnError(err, ctx))
    await runLifeCycleHook(hooks, 'after:publish', dryRun)
  }
  
  async githubTask(ctx: ReleaseContext, config: ResolvedConfig) {
    const { noGitHub, dryRun } = ctx
    const { hooks } = config
    
    if (noGitHub) return
    
    await runGithubPrompts(ctx, config)
    
    await runLifeCycleHook(hooks, 'before:release', dryRun)
    await tasks([
      {
        title: MSG.TASK.GITHUB.START,
        task: async () => {
          const { github: { owner, repo }, git: { currentTag } } = ctx
          
          await createRelease(ctx, config)
          const url = getGithubReleaseUrl(owner, repo, currentTag)
          return success(MSG.TASK.GITHUB.END(url), dryRun)
        },
      },
    ]).catch((err) => abortOnError(err, ctx))
    await runLifeCycleHook(hooks, 'after:release', dryRun)
  }
}
