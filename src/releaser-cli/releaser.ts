import { intro, log, outro } from '@clack/prompts'
import { readJsonFileSync, type StyleFormat, styleText } from '@peiyanlu/node-utils'
import { isEmptyObject, isString, omit } from '@peiyanlu/ts-utils'
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
import { runBumpPrompts, runConfirmPrompts, runSkippedStepsPrompts } from './prompts.ts'


export interface ReleaserCliRunOptions {
  dryRun?: boolean
  ci?: boolean
  
  skipBump?: boolean
  skipGit?: boolean
  skipPublish?: boolean
  skipRelease?: boolean
  
  releaseType?: ReleaseType
  preId?: string
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
  
  setSkippedOptions(options: ReleaserCliRunOptions): this {
    return this.enqueue(async () => {
      const { project, stepsOptions: { bump: bumpOpts } } = this
      
      const version = await project.manifest.getVersion()
      
      const skippedSteps = await runSkippedStepsPrompts(options)
      
      this.setSkippedSteps({
        bump: version === bumpOpts?.version && !bumpOpts?.firstRelease,
        ...skippedSteps,
      })
    })
  }
  
  setBumpOptions(options: ReleaserCliRunOptions): this {
    return this.enqueue(async () => {
      const logger = this.logger.createChild('prompts-options')
      
      const { skipBump } = options
      const { project, stepsOptions: { bump: bumpOpts } } = this
      
      const version = await project.manifest.getVersion()
      
      const bump = skipBump
        ? { version } as PickOverridableOptions<P['bump']>
        : await runBumpPrompts(project, {
          bump: {
            ...bumpOpts,
          } as PickOverridableOptions<P['bump']>,
          run: options,
        })
      const promptsSteps: ReleaserStepsOptions<P, G> = {
        bump,
      }
      
      logger.verbose('Prompts result for steps:')
      logger.verbose(promptsSteps)
      
      if (!isEmptyObject(promptsSteps.bump)) {
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
  
  setLegacyOptions(): this {
    return this.enqueue(async () => {
      const logger = this.logger.createChild('legacy-options')
      
      const { config, file } = await loadConfig<UserConfig<P, G>>(process.cwd())
      const legacySteps = omit(config, [ 'project', 'hosting', 'releaser' ])
      
      if (file) {
        logger.verbose('Legacy config file:')
        logger.verbose(file)
        logger.verbose('Legacy config for steps:')
        logger.verbose(legacySteps)
      }
      
      if (!isEmptyObject(legacySteps)) {
        this.setOptions(legacySteps)
      }
    })
  }
  
  setCliOptions(options: ReleaserCliRunOptions): this {
    return this.enqueue(async () => {
      const logger = this.logger.createChild('cli-options')
      
      const { releaseType: as, preId: prerelease } = options
      const cliSteps: ReleaserStepsOptions<P, G> = {
        bump: {
          ...as ? { as } : {},
          ...prerelease ? { prerelease } : {},
        } as PickOverridableOptions<P['bump']>,
      }
      
      logger.verbose('Cli options for steps:')
      logger.verbose(cliSteps)
      
      if (!isEmptyObject(cliSteps.bump)) {
        this.setOptions(cliSteps)
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
      .setLegacyOptions()
      .setCliOptions(options)
      .setBumpOptions(options)
      .setSkippedOptions(options)
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
