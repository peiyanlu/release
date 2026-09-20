import { intro, log, outro } from '@clack/prompts'
import { gitConfigGet, isGitRepo, isWorkingTreeClean } from '@peiyanlu/cli-utils'
import { assert, isString, omit, throwError } from '@peiyanlu/ts-utils'
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
import type { PickOverridableOptions, Project, ReleaserOptions } from '../core/index.js'
import { Logger } from '../core/logger.js'
import { Releaser } from '../core/releaser.js'
import { GithubHosting } from '../hosting-github/github.js'
import { getCliPromptOptions, runConfirmPrompts } from './prompts.js'


export interface ReleaserCliRunOptions {
  dryRun?: boolean
  ci?: boolean
  
  releaseCount?: number
  
  skipGit?: boolean
  skipPublish?: boolean
  skipRelease?: boolean
  
  releaseType?: ReleaseType
}

export type ReleaserCliOptions<P extends Project = Project> = ReleaserOptions<P, GithubHosting>


export class ReleaserCli<P extends Project = Project> extends Releaser<P, GithubHosting> {
  declare readonly hosting: GithubHosting
  
  override tag(): this {
    return super.tag({
      fetch: true,
    })
  }
  
  override push(): this {
    return super.push({
      force: true,
    })
  }
  
  override release(): this {
    const { hosting } = this
    
    if (!hosting) {
      throwError('Hosting service is not configured. Please set the hosting option.')
    }
    
    return this.enqueue(async () => {
      const { project, options: { dryRun } } = this
      const logger = this.logger.createChild('release')
      
      logger.info('Creating release...')
      
      await hosting.createWebRelease({
        project,
        dryRun,
        logger,
      })
    })
  }
  
  override async run(...args: []): Promise<void> {
    await super.run(...args)
    this.end()
  }
  
  constructor(options: ReleaserCliOptions<P>) {
    super({
      hosting: new GithubHosting(),
      logger: new Logger({
        silent: options.silent,
        dryRun: options.dryRun,
        verbose: options.verbose,
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
  
  check(): this {
    return this.enqueue(async () => {
      const { project, hosting, stepsOptions } = this
      const { commit = {}, tag = {}, push = {}, publish = {}, release = {} } = stepsOptions
      
      const isTrue = (v: unknown) => true === v
      
      const logger = this.logger.createChild('check')
      
      const skipGit = [ commit.skip, tag.skip, push.skip ].every(isTrue)
      const skipPublish = isTrue((publish as PickOverridableOptions<P['publish']>).skip)
      const skipRelease = isTrue(release.skip)
      
      logger.info('Checking release environment...')
      
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
      
      await project.publishCheck({ logger, skip: skipPublish })
      
      await hosting.releaseCheck({ logger, skip: skipGit || skipRelease })
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
  
  fetchOptions(options: ReleaserCliRunOptions): this {
    return this.enqueue(async () => {
      const { ci, dryRun, releaseType: as, releaseCount } = options
      const { project, logger } = this
      
      const { config, file } = await loadConfig<UserConfig<P, GithubHosting>>(process.cwd())
      
      const legacySteps = omit(config, [ 'project', 'hosting', 'releaser' ])
      
      if (file) {
        logger.info('fetch-options', `Legacy config file: ${ file }`)
        logger.info('fetch-options', 'Legacy config for steps:')
        logger.info('fetch-options', legacySteps)
      }
      
      const promptSteps = await getCliPromptOptions(project, {
        bump: {
          ...legacySteps.bump,
          as,
          releaseCount,
        } as PickOverridableOptions<P['bump']>,
        run: options,
      })
      
      await runConfirmPrompts(ci, dryRun)
      
      this
        .setOptions(legacySteps)
        .setOptions(promptSteps)
    })
  }
  
  async runAction(options: ReleaserCliRunOptions): Promise<void> {
    await this
      .start()
      .fetchOptions(options)
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
