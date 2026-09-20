import { intro, log, outro } from '@clack/prompts'
import { gitConfigGet, isGitRepo, isWorkingTreeClean } from '@peiyanlu/cli-utils'
import { assert, isString, omit } from '@peiyanlu/ts-utils'
import {
  blue,
  blueBright,
  cyan,
  cyanBright,
  dim,
  green,
  greenBright,
  magenta,
  magentaBright,
  red,
  redBright,
  yellow,
} from 'ansis'
import type { ReleaseType } from 'semver'
import pkgJson from '../../package.json' with { type: 'json' }
import { loadConfig, type UserConfig } from '../config/index.js'
import type {
  GitRepositoryHosting,
  PickOverridableOptions,
  Project,
  ReleaserOptions,
  ReleaserPushOptions,
  ReleaserStep,
  ReleaserTagOptions,
} from '../core/index.js'
import { Logger } from '../core/logger.js'
import { Releaser } from '../core/releaser.js'
import { getCliPromptOptions, runBumpPrompts, runConfirmPrompts } from './prompts.js'


export interface ReleaserCliRunOptions {
  dryRun?: boolean
  ci?: boolean
  
  skipGit?: boolean
  skipPublish?: boolean
  skipRelease?: boolean
  
  releaseType?: ReleaseType
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
          blue,
          blueBright,
          cyan,
          cyanBright,
          green,
          greenBright,
          magenta,
          magentaBright,
          red,
          redBright,
        ].sort(() => Math.random() - .5),
        printer: ({ dryRun, stage, message, color }) => {
          const msg = isString(message) ? message : JSON.stringify(message, null, 2)
          log.message(dim`${ dryRun ? yellow`[dry-run]` : '' }${ color(`[${ stage }]`) }: ${ msg }`)
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
  
  setCliOptions(options: ReleaserCliRunOptions): this {
    return this.enqueue(async () => {
      const { ci, dryRun, releaseType: as } = options
      const { project, stepsOptions: { bump: bumpOpts } } = this
      
      const bump = await runBumpPrompts(project, {
        bump: {
          ...bumpOpts,
          as,
        } as PickOverridableOptions<P['bump']>,
        run: options,
      })
      
      this
        .setOptions({ bump })
        .setSkippedSteps(await getCliPromptOptions(options))
      
      await runConfirmPrompts(ci, dryRun)
    })
  }
  
  setLegacyOptions(): this {
    return this.enqueue(async () => {
      const logger = this.logger.createChild('legacy-options')
      
      const { config, file } = await loadConfig<UserConfig<P, G>>(process.cwd())
      const legacySteps = omit(config, [ 'project', 'hosting', 'releaser' ])
      
      if (file) {
        logger.verbose(`Legacy config file: ${ file }`)
        logger.verbose('Legacy config for steps:')
        logger.verbose(legacySteps)
      }
      
      this.setOptions(legacySteps)
    })
  }
  
  check(): this {
    return this.enqueue(async () => {
      const { project, hosting } = this
      const logger = this.logger.createChild('check')
      
      logger.info('Checking release environment...')
      
      const skipGit = ([ 'commit', 'tag', 'push' ] as ReleaserStep[]).every(k => this.shouldSkip(k))
      if (!skipGit) {
        logger.verbose('Checking Git repository...')
        
        const isRepo = await isGitRepo()
        assert(isRepo, 'Current directory is not a Git repository')
        
        logger.verbose('Checking working tree...')
        
        const isClean = await isWorkingTreeClean()
        assert(isClean, 'Git working tree is not clean')
        
        logger.verbose('Checking remote repository...')
        
        const hasRemote = await gitConfigGet('remote.origin.url')
        assert(hasRemote, 'Git remote "origin" is not configured')
      }
      
      if (!this.shouldSkip('publish')) {
        await project.publishCheck({ logger })
      }
      
      if (!this.shouldSkip('release')) {
        await hosting?.releaseCheck({ logger })
      }
    })
  }
  
  start(): this {
    return this.enqueue(async () => {
      const { name, version } = pkgJson
      
      console.log(`${ blue`i` } ${ name } v${ version }\n`)
      
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
      .check()
      .bump()
      .commit()
      .tag()
      .push()
      .publish()
      .release()
      .run()
  }
}
