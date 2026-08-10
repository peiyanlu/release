import { intro, select, tasks } from '@clack/prompts'
import {
  bumpPackageVersion,
  type CliOptions,
  coloredStatus,
  eol,
  getGithubReleaseUrl,
  getGithubUrl,
  getLogSince,
  getPackageInfo,
  getPackageUrl,
  getShortStatus,
  gitAddAll,
  isOtpError,
  isPrerelease,
  parseVersion,
  resolveChangelogRange,
} from '@peiyanlu/cli-utils'
import { isBoolean, isNotEmpty, isNumber, isZero } from '@peiyanlu/ts-utils'
import { publint } from 'publint'
import { formatMessage } from 'publint/utils'
import { inc, neq, type ReleaseType } from 'semver'
import pkgJson from '../package.json' with { type: 'json' }
import { mergeConfig, resolveConfig, type UserConfig } from './config.js'
import { createDefaultConfig, createDefaultContext } from './defaults.js'
import { generateChangelog, getChangelog, inferReleaseType } from './git/changelog.js'
import { commitAndTag, gitCheck, gitRollback } from './git/commit.js'
import { runGitPrompts } from './git/prompts.js'
import { runGithubPrompts } from './github/prompts.js'
import { createRelease, githubCheck } from './github/release.js'
import { MSG } from './messages.js'
import { runNpmOptPrompts, runNpmPublishPrompts } from './npm/prompts.js'
import { npmCheck, publishNpm } from './npm/publish.js'
import type { ReleaseConfig, ReleaseContext, ResolvedConfig } from './types.js'
import {
  abortOnError,
  abortSinglePrompt,
  abortTask,
  diff,
  formatTemplate,
  info,
  msg,
  question,
  runLifeCycleHook,
  success,
  taskEnd,
} from './utils.js'
import { runVersionPrompts } from './version/prompts.js'


export interface ReleaseCliOptions extends CliOptions<string | number | boolean | undefined> {
  prepare: boolean
  dryRun: boolean
  package: string
  otp: string
  ci: boolean
  showChangelog: boolean
  showRelease: boolean
  onlyChangelog: boolean
  // config start
  requireCleanWorkingTree: boolean
  releaseCount: number
  skipGit: boolean
  skipNpm: boolean
  skipGithub: boolean
  isMonorepo: boolean
  includeHidden: boolean
  // config end
}


export class Action {
  async handleRelease(cmdArgs: string, options: ReleaseCliOptions) {
    const { ctx, config } = await this.createContext(cmdArgs, options)
    
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
    
    if (ctx.dryRun) gitRollback(ctx)
    taskEnd(MSG.OUTRO(ctx.dryRun))
  }
  
  async handlePrepareRelease(cmdArgs: string, options: ReleaseCliOptions) {
    const { ctx, config } = await this.createContext(cmdArgs, options)
    
    // 1️⃣ 预检查阶段
    await this.checkTask(ctx, config)
    
    // 2️⃣ 版本升级阶段
    await this.bumpTask(ctx, config)
    
    // 3️⃣ 生成 Changelog
    await this.changelogTask(ctx, config)
    
    // 4️⃣ Git 操作阶段
    await this.gitTask(ctx, config)
    
    if (ctx.dryRun) gitRollback(ctx)
    taskEnd(MSG.OUTRO_PREPARE(ctx.dryRun))
  }
  
  async createContext(cmdArgs: string, options: ReleaseCliOptions) {
    const { configFile, config } = await this.createConfig(options)
    
    info(MSG.INFO.TOOL(pkgJson.name, pkgJson.version))
    info(MSG.INFO.CONFIG(configFile))
    
    console.log()
    
    const { otp, package: defPkg, prepare, showChangelog, showRelease, ci, dryRun, onlyChangelog } = options
    intro(prepare ? MSG.INTRO_PREPARE(dryRun) : MSG.INTRO(dryRun))
    
    const { isMonorepo, packages, getPkgDir, skipGit, skipNpm, skipGithub } = config
    
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
        configFileExists: isNotEmpty(configFile),
        dryRun,
        showRelease,
        showChangelog,
        onlyChangelog,
        npm: { otp: String(otp) },
        increment: cmdArgs,
        isIncrement: true,
        isCI: [ ci, showChangelog, showRelease, process.env.GITHUB_ACTIONS, process.env.CI ].some(Boolean),
        pkg: {
          name: pkgName,
          isPrivate: pkgPrivate,
          fromPreRelease: isPrerelease(pkgVersion),
          current: pkgVersion,
          next: nextVersion,
          toPreRelease: false,
          publishConfig: { ...publishConfig },
        },
        noGit: skipGit,
        noNpm: pkgPrivate || skipNpm,
        noGitHub: skipGit || skipGithub,
      },
    )
    
    const { messages } = await publint({ pkgDir })
    for (const message of messages) {
      const formated = formatMessage(message, pkg)
      formated && msg('PKG', formated)
    }
    
    return { ctx, config }
  }
  
  async createConfig(options: ReleaseCliOptions) {
    const {
      ci,
      requireCleanWorkingTree,
      skipGit,
      skipNpm,
      skipGithub,
      isMonorepo,
      includeHidden,
      releaseCount,
    } = options
    
    const toFalse = (value: unknown): boolean | undefined => {
      return isBoolean(value) && !value ? value : undefined
    }
    const toNumber = (value: unknown): number | undefined => {
      return isNumber(value) ? value : undefined
    }
    
    const defaultConfig = createDefaultConfig(ci ? true : undefined)
    
    const { configFile, config: local } = await this.resolveUserConfig<ReleaseConfig>(process.cwd())
    const config: ResolvedConfig = mergeConfig<ResolvedConfig>(
      mergeConfig<ResolvedConfig>(defaultConfig, local),
      {
        changelog: {
          releaseCount: toNumber(releaseCount),
          includeHidden,
        },
        git: {
          requireCleanWorkingTree: toFalse(requireCleanWorkingTree),
        },
        skipGit,
        skipNpm,
        skipGithub,
        isMonorepo,
      } satisfies UserConfig,
    )
    
    return { configFile, config }
  }
  
  async resolveUserConfig<T>(cwd = process.cwd()) {
    return resolveConfig<T>(cwd)
  }
  
  async printChangelog(ctx: ReleaseContext, config: ResolvedConfig) {
    const { showChangelog, selectedPkg, noGit, isIncrement } = ctx
    const { isMonorepo, getPkgDir, changelog: { tagPrefix, releaseCount, includeHidden, transformTypes } } = config
    
    if (noGit) return
    
    // 打印 Changelog
    const match = isMonorepo ? `${ tagPrefix?.(selectedPkg) }*` : '*'
    const { from, to } = isZero(releaseCount)
      ? { from: '', to: 'HEAD' }
      : await resolveChangelogRange(isIncrement, match)
    const commits = await getLogSince(from, to, getPkgDir(selectedPkg))
    const changelog = await getChangelog({
      getPkgDir: () => getPkgDir(selectedPkg),
      tagPrefix: tagPrefix?.(selectedPkg),
      releaseCount,
      includeHidden,
      transformTypes,
    })
    Object.assign(ctx.github, { changelog })
    
    if (commits) {
      msg('GIT', `Changelog(${ from }...${ to }):${ eol(2) }` + changelog)
      msg('GIT', `Commits(${ from }...${ to }):${ eol(2) }` + commits)
      if (showChangelog) taskEnd(MSG.LOG.SHOW_CHANGELOG)
    } else {
      msg('GIT', MSG.LOG.CHANGELOG_EMPTY)
    }
  }
  
  async checkTask(ctx: ReleaseContext, config: ResolvedConfig) {
    const { dryRun, onlyChangelog } = ctx
    await tasks([
      {
        title: MSG.CHECK.GIT.CHECKING,
        task: async () => {
          await gitCheck(ctx, config)
          const { git: { remoteName, remoteUrl } } = ctx
          
          return success(MSG.CHECK.GIT.CHECKED(remoteName, remoteUrl), dryRun)
        },
        enabled: !ctx.noGit,
      },
      {
        title: MSG.CHECK.NPM.CHECKING,
        task: async () => {
          const msg = await npmCheck(ctx, config)
          const { pkg: { publishConfig: { registry } } } = ctx
          
          return success(MSG.CHECK.NPM.CHECKED(registry, msg), dryRun)
        },
        enabled: !(ctx.noNpm || onlyChangelog),
      },
      {
        title: MSG.CHECK.GITHUB.CHECKING,
        task: async () => {
          await githubCheck(ctx, config)
          const { github: { owner, repo } } = ctx
          const repository = getGithubUrl(owner, repo)
          
          return success(MSG.CHECK.GITHUB.CHECKED(repository), dryRun)
        },
        enabled: !(ctx.noGitHub || onlyChangelog),
      },
    ]).catch(abortOnError)
  }
  
  async bumpTask(ctx: ReleaseContext, config: ResolvedConfig) {
    const { pkg: { current }, dryRun, isCI, showRelease, selectedPkg, onlyChangelog } = ctx
    const { hooks, getPkgDir, changelog: { includeHidden, transformTypes } } = config
    
    if (onlyChangelog) return
    
    const need = (ctx: ReleaseContext) => {
      const { pkg: { next }, isIncrement } = ctx
      return !next && isIncrement
    }
    
    if (need(ctx)) {
      const res = await inferReleaseType({ includeHidden, transformTypes, json: true })
      if (res) msg('BUMP', res.reason)
      const inferred = res?.releaseType
      
      const ciVersion = isCI ? inc(current, inferred ?? 'patch') : undefined
      const nextVersion = ciVersion || await runVersionPrompts(ctx, config, inferred)
      
      ctx.isIncrement = neq(current, nextVersion)
      
      const { version: next, isPrerelease: toPreRelease, preId, preBase } = parseVersion(nextVersion)
      Object.assign(ctx.pkg, { next, toPreRelease, preId, preBase })
    }
    
    const { pkg: { next } } = ctx
    
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
        enabled: true,
      },
    ]).catch((err) => abortOnError(err, ctx))
    await runLifeCycleHook(hooks, 'after:bump', dryRun)
    
    await this.printChangelog(ctx, config)
  }
  
  async changelogTask(ctx: ReleaseContext, config: ResolvedConfig) {
    const { isIncrement, dryRun, selectedPkg, noGit, onlyChangelog } = ctx
    const { getPkgDir, changelog: { tagPrefix, releaseCount, includeHidden, transformTypes } } = config
    
    if (noGit) return
    
    await tasks([
      {
        title: MSG.TASK.CHANGELOG.START,
        task: async () => {
          await generateChangelog({
            getPkgDir: () => getPkgDir(selectedPkg),
            tagPrefix: tagPrefix?.(selectedPkg),
            releaseCount,
            includeHidden,
            transformTypes,
          })
          await gitAddAll()
          
          return success(MSG.TASK.CHANGELOG.END, dryRun)
        },
        enabled: isIncrement,
      },
    ]).catch((err) => abortOnError(err, ctx))
    
    // 打印 Changes
    const changeset = await getShortStatus()
    if (changeset) {
      msg('GIT', `Changes:${ eol(2) }` + coloredStatus(changeset))
    } else {
      msg('GIT', MSG.LOG.CHANGES_EMPTY)
    }
    
    if (onlyChangelog) taskEnd(MSG.LOG.ONLY_CHANGELOG)
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
          
          const { git: { push } } = config
          return success(MSG.TASK.GIT.END(Boolean(push)), dryRun)
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
          
          const { npm: { publish } } = config
          const url = publish ? getPackageUrl(name, next) : undefined
          return success(MSG.TASK.NPM.END(url), dryRun)
        },
      },
    ]).catch((err) => abortOnError(err, ctx, false))
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
          await createRelease(ctx, config)
          
          const { github: { owner, repo }, git: { currentTag } } = ctx
          const { github: { release } } = config
          const url = release ? getGithubReleaseUrl(owner, repo, currentTag) : undefined
          return success(MSG.TASK.GITHUB.END(url), dryRun)
        },
      },
    ]).catch((err) => abortOnError(err, ctx, false))
    await runLifeCycleHook(hooks, 'after:release', dryRun)
  }
}
