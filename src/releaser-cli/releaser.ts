import { intro, log, outro } from '@clack/prompts'
import { readJsonFileSync, type StyleFormat, styleText } from '@peiyanlu/node-utils'
import { equals, isEmptyObject, isString, isUndefined, merge, omit } from '@peiyanlu/ts-utils'
import { join } from 'node:path'
import type { ReleaseType } from 'semver'
import { loadConfig, type UserConfig } from '../config/index.ts'
import {
  type GitRepositoryHosting,
  type PickOverridableOptions,
  type Project,
  type ReleaserOptions,
  type ReleaserPushOptions,
  type ReleaserStepsOptions,
  type ReleaserTagOptions,
} from '../core/index.ts'
import { Logger } from '../core/logger.ts'
import { Releaser } from '../core/releaser.ts'
import { runBumpPrompts, runConfirmPrompts, runStepsSkipPrompts } from './prompts.ts'


export interface ReleaserCliRunOptions {
  dryRun?: boolean
  ci?: boolean
  
  skipBump?: boolean
  skipGit?: boolean
  skipPublish?: boolean
  skipRelease?: boolean
  
  releaseType?: ReleaseType
  preId?: string
  
  config?: UserConfig
}

export interface CliStepsSkip {
  commit?: boolean
  tag?: boolean
  push?: boolean
  publish?: boolean
  release?: boolean
}

export type ReleaserCliOptions<
  P extends Project = Project,
  G extends GitRepositoryHosting = GitRepositoryHosting
> = ReleaserOptions<P, G>


const pkgJson = readJsonFileSync(join(__dirname, '..', 'package.json'))

export class ReleaserCli<
  P extends Project = Project,
  G extends GitRepositoryHosting = GitRepositoryHosting
> extends Releaser<P, G> {
  constructor(options: ReleaserCliOptions<P, G>) {
    const { silent, dryRun, verbose } = options
    super({
      logger: new Logger({
        silent,
        dryRun,
        verbose,
        colors: [
          'blue',
          'blueBright',
          'cyan',
          'cyanBright',
          'green',
          'greenBright',
          'magenta',
          'magentaBright',
          'red',
          'redBright',
        ].sort(() => Math.random() - .5).map(k => styleText[k as StyleFormat]),
        printer: ({ dryRun, stage, message, color }) => {
          const msg = isString(message) ? message : JSON.stringify(message, null, 2)
          log.message(styleText.dim`${ dryRun ? styleText.yellow`[dry-run]` : '' }${ color(`[${ stage }]`) }: ${ msg }`)
        },
      }),
      ...options,
    })
  }
  
  override tag(options: ReleaserTagOptions = {}): this {
    return super.tag({
      fetch: true,
      ...options,
    })
  }
  
  override push(options: ReleaserPushOptions = {}): this {
    return super.push({
      force: true,
      ...options,
    })
  }
  
  override async run(...args: []): Promise<void> {
    await super.run(...args)
    this.end()
  }
  
  applyStepsSkipPromptsOptions(options: ReleaserCliRunOptions): this {
    return this.enqueue(async () => {
      const logger = this.logger.createChild('apply-prompts-options')
      const { project, stepsOptions: { bump: bumpOpts }, stepsSkipOptions } = this
      
      const stepsSkip = await runStepsSkipPrompts({
        stepsSkip: stepsSkipOptions,
        run: options,
      })
      
      logger.verbose('Steps skip prompts result for steps:')
      logger.verbose(stepsSkip)
      
      this.setSkipOptions({
        bump: equals(await project.manifest.getVersion(), bumpOpts?.version) && !bumpOpts?.firstRelease,
        ...stepsSkip,
      })
    })
  }
  
  applyBumpPromptsOptions(options: ReleaserCliRunOptions): this {
    return this.enqueue(async () => {
      const logger = this.logger.createChild('apply-prompts-options')
      const { project, stepsOptions: { bump: bumpOpts }, stepsSkipOptions: { bump: skipBump } } = this
      
      const bump = skipBump
        ? {
          version: await project.manifest.getVersion(),
        } as PickOverridableOptions<P['bump']>
        : await runBumpPrompts(project, {
          bump: {
            ...bumpOpts,
          } as PickOverridableOptions<P['bump']>,
          run: options,
        })
      const promptsSteps: ReleaserStepsOptions<P, G> = { bump }
      
      logger.verbose('Bump prompts result for steps:')
      logger.verbose(promptsSteps)
      
      if (!isEmptyObject(bump)) {
        this.setOptions(promptsSteps)
      }
    })
  }
  
  confirmWorkflow(options: ReleaserCliRunOptions): this {
    return this.enqueue(async () => {
      const { ci, dryRun } = options
      
      await runConfirmPrompts(ci, dryRun)
    })
  }
  
  applyLocalOptions(): this {
    return this.enqueue(async () => {
      const logger = this.logger.createChild('apply-local-options')
      
      const { config, file } = await loadConfig<UserConfig<P, G>>(process.cwd())
      const { stepsSkip = {}, ...localSteps } = omit(config, [ 'project', 'hosting', 'releaser' ])
      
      if (!file) {
        logger.verbose('Local config file not provide.')
        return
      } else {
        logger.verbose('Local config file:')
        logger.verbose(file)
      }
      
      logger.verbose('Local config for steps:')
      logger.verbose({ ...localSteps, stepsSkip })
      
      if (!isEmptyObject(localSteps)) {
        this.setOptions(localSteps)
      }
      
      if (!isEmptyObject(stepsSkip)) {
        this.setSkipOptions(stepsSkip)
      }
    })
  }
  
  applyCliOptions(options: ReleaserCliRunOptions): this {
    return this.enqueue(async () => {
      const { releaseType, preId, skipBump, skipGit, skipPublish, skipRelease, config } = options
      const logger = this.logger.createChild('apply-cli-options')
      
      const filter = (obj: object) => {
        return Object.fromEntries(Object.entries(obj).filter(([ _k, v ]) => !isUndefined(v)))
      }
      
      const merged = merge(config, {
        bump: filter({
          as: releaseType,
          prerelease: preId,
        }) as PickOverridableOptions<P['bump']>,
        stepsSkip: filter({
          bump: skipBump,
          commit: skipGit,
          tag: skipGit,
          push: skipGit,
          publish: skipPublish,
          release: skipRelease,
        }),
      }) satisfies UserConfig<P, G>
      const { stepsSkip = {}, ...cliSteps } = omit(merged, [ 'project', 'hosting', 'releaser' ])
      
      logger.verbose('Cli config for steps:')
      logger.verbose({ ...cliSteps, stepsSkip })
      
      if (!isEmptyObject(cliSteps)) {
        this.setOptions(cliSteps)
      }
      
      if (!isEmptyObject(stepsSkip)) {
        this.setSkipOptions(stepsSkip)
      }
    })
  }
  
  start(): this {
    return this.enqueue(async () => {
      const { name, version } = pkgJson
      
      console.log(`${ styleText.blue`i` } ${ name } v${ version }\n`)
      
      intro('🚀 Starting release')
    })
  }
  
  end(): void {
    const { options: { dryRun = false } } = this
    
    outro(`🎉 ${ dryRun ? 'Dry run complete' : 'Release complete' }`)
    process.exit(0)
  }
  
  async runAction(options: ReleaserCliRunOptions): Promise<void> {
    await this
      .start()
      .applyLocalOptions()
      .applyCliOptions(options)
      .applyBumpPromptsOptions(options)
      .applyStepsSkipPromptsOptions(options)
      .confirmWorkflow(options)
      .bump()
      .commit()
      .tag()
      .push()
      .publish()
      .release()
      .run()
  }
}
