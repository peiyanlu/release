import {
  gitAdd,
  gitBranch,
  gitBranchCurrent,
  gitCheckoutBranch,
  gitCheckoutBranchForce,
  gitCommitMessage,
  gitConfigSet,
  gitFetch,
  gitLsRemote,
  gitPush,
  gitPushBranch,
  gitRevParse,
  gitTag,
} from '@peiyanlu/cli-utils'
import { throwError } from '@peiyanlu/ts-utils'
import type { GitRepositoryHosting } from './hosting/hosting.js'
import { Logger } from './logger.js'
import type { Project } from './project/project.js'
import type {
  PickOverridableOptions,
  ReleaserCheckoutOptions,
  ReleaserCommitOptions,
  ReleaserMaintenanceBranchOptions,
  ReleaserOptions,
  ReleaserPushOptions,
  ReleaserSetUserOptions,
  ReleaserSkipOptions,
  ReleaserStep,
  ReleaserStepsOptions,
  ReleaserTagOptions,
} from './releaser.type.js'
import { when } from './utils.js'


export class Releaser<
  P extends Project = Project,
  G extends GitRepositoryHosting = GitRepositoryHosting
> {
  readonly project: P
  readonly hosting?: G
  readonly logger: Logger
  readonly stepsOptions: ReleaserStepsOptions<P, G> = {}
  protected readonly skippedSteps: ReleaserSkipOptions = {}
  protected readonly state: {
    headBranch?: string
    baseBranch?: string
    bump?: boolean
    tags?: boolean
  } = {}
  private readonly queue: (() => Promise<unknown>)[] = []
  
  constructor(public options: ReleaserOptions<P, G>) {
    const { project, hosting, logger, ...log } = options
    
    this.project = project
    this.hosting = hosting
    this.logger = logger ?? new Logger(log)
  }
  
  enqueue(fn: () => Promise<void>): this {
    this.queue.push(fn)
    return this
  }
  
  setOptions(options: ReleaserStepsOptions<P, G>): this {
    const logger = this.logger.createChild('set-options')
    
    logger.verbose('Setting options for steps:')
    logger.verbose(options)
    
    for (const [ key, value ] of Object.entries(options)) {
      Object.assign(
        this.stepsOptions[key as keyof ReleaserStepsOptions] ??= {},
        value,
      )
    }
    
    logger.verbose('Final options for steps:')
    logger.verbose(this.stepsOptions)
    
    return this
  }
  
  setUser(options?: ReleaserSetUserOptions): this {
    return this.enqueue(async () => {
      const { options: { dryRun }, stepsOptions: { setUser } } = this
      const { username, email } = { ...setUser, ...options }
      const logger = this.logger.createChild('set-user')
      
      if (this.shouldSkip('setUser')) {
        logger.info('Skipping set git user.')
        return
      }
      
      logger.info('Setting git user...')
      
      if (!username && !email) {
        logger.info('No git user configuration provided.')
        return
      }
      
      if (username) {
        logger.verbose(`Setting git user.name to "${ username }".`)
        
        if (!dryRun) {
          await gitConfigSet('user.name', username)
        }
      }
      
      if (email) {
        logger.verbose(`Setting git user.email to "${ email }".`)
        
        if (!dryRun) {
          await gitConfigSet('user.email', email)
        }
      }
    })
  }
  
  setSkippedSteps(options: ReleaserSkipOptions): this {
    const logger = this.logger.createChild('set-skipped-steps')
    
    logger.verbose('Setting skipped for steps:')
    logger.verbose(options)
    
    Object.assign(this.skippedSteps, options)
    
    logger.verbose('Final skipped for steps:')
    logger.verbose(this.skippedSteps)
    
    return this
  }
  
  checkout(options?: ReleaserCheckoutOptions): this {
    return this.enqueue(async () => {
      const { options: { dryRun }, stepsOptions: { checkout } } = this
      const { branch: headBranch = 'release-branch', fetch, force } = { ...checkout, ...options }
      const logger = this.logger.createChild('checkout')
      
      if (this.shouldSkip('checkout')) {
        logger.info('Skipping checkout.')
        return
      }
      
      logger.info(`Checking out branch ${ headBranch }...`)
      
      this.state.headBranch = headBranch
      this.state.baseBranch = await this.getBaseBranch()
      
      if (fetch) {
        logger.verbose(`Fetching all commits and tags from the remote repository...`)
        
        if (!dryRun) {
          await gitFetch([
            '--prune',
            '--unshallow',
            '--tags',
            '--',
            'origin',
            'HEAD',
          ])
        }
      }
      
      if (force) {
        logger.verbose(`Force checking out branch ${ headBranch }...`)
        
        if (!dryRun) {
          await gitCheckoutBranchForce(headBranch)
        }
      } else {
        logger.verbose(`Checking out branch ${ headBranch }...`)
        
        if (!dryRun) {
          await gitCheckoutBranch(headBranch)
        }
      }
    })
  }
  
  bump(options?: PickOverridableOptions<P['bump']>): this {
    return this.enqueue(async () => {
      const { project, options: { dryRun }, stepsOptions: { bump } } = this
      const logger = this.logger.createChild('bump')
      
      if (this.shouldSkip('bump')) {
        logger.info('Skipping bump.')
        return
      }
      
      logger.info('Bumping version...')
      
      const done = await project.bump({
        dryRun,
        logger,
        ...bump,
        ...options,
      })
      
      this.state.bump = done
      
      if (!done) {
        logger.info('No version changes detected.')
      }
    })
  }
  
  commit(options?: ReleaserCommitOptions): this {
    return this.enqueue(async () => {
      const { project, options: { dryRun }, state, stepsOptions: { commit } } = this
      const { sign, allowEmpty } = { ...commit, ...options }
      const logger = this.logger.createChild('commit')
      
      if (this.shouldSkip('commit')) {
        logger.info('Skipping commit.')
        return
      }
      
      logger.info(`Committing changes...`)
      
      if (!state.bump) {
        logger.info('No changes to commit.')
        return
      }
      
      const files = project.changedFiles
      const message = await project.getCommitMessage()
      
      logger.verbose(`Files to commit:`)
      
      files.forEach((file) => {
        logger.verbose(`- ${ file }`)
      })
      
      logger.verbose(
        message.includes('\n')
          ? `Commit message:\n\n${ message }`
          : `Commit message: ${ message }`,
      )
      
      if (!dryRun) {
        await gitAdd([ '--', ...files ])
        
        await gitCommitMessage(message, [
          ...when(sign, '--gpg-sign'),
          ...when(allowEmpty, '--allow-empty'),
          '--no-verify',
        ])
      }
    })
  }
  
  revert(): this {
    return this.enqueue(async () => {
      const { project, logger, options: { dryRun } } = this
      
      logger.info('revert', 'Reverting version updates...')
      
      const done = await project.revert({
        dryRun,
        logger: logger.createChild('revert'),
      })
      
      if (!done) {
        logger.info('revert', 'No version updates to revert.')
        return
      }
      
      this.state.bump = false
    })
  }
  
  maintenanceBranch(options?: ReleaserMaintenanceBranchOptions): this {
    return this.enqueue(async () => {
      const { project, options: { dryRun }, stepsOptions: { maintenanceBranch } } = this
      const { enabled, force } = { ...maintenanceBranch, ...options }
      const logger = this.logger.createChild('maintenance-branch')
      
      if (this.shouldSkip('maintenanceBranch')) {
        logger.info('Skipping create maintenance branches.')
        return
      }
      
      logger.info('Creating maintenance branches...')
      
      if (!enabled) {
        logger.info('Maintenance branch creation is disabled.')
        return
      }
      
      logger.verbose('Fetching fresh tags from the remote repository...')
      
      if (!dryRun) {
        await gitFetch([ '--tags' ])
      }
      
      const branches = await project.getMaintenanceBranches()
      
      if (!branches.length) {
        logger.info('No maintenance branches to create.')
        return
      }
      
      logger.verbose('Branches to create:')
      
      for (const { from, to } of branches) {
        logger.verbose(`- ${ to } from ${ from }`)
        
        if (dryRun) {
          continue
        }
        
        const branchExists = await gitRevParse([ '--verify', `refs/heads/${ to }` ])
          || await gitLsRemote([ '--heads', 'origin', to ])
        
        if (branchExists && !force) {
          logger.info(`Branch ${ to } already exists, skipping.`)
          continue
        }
        
        const args = when(force, '--force')
        
        await gitBranch([ ...args, '--', to, from ])
        await gitPushBranch('origin', to, [ '--no-verify', ...args ])
      }
    })
  }
  
  tag(options?: ReleaserTagOptions): this {
    return this.enqueue(async () => {
      const { project, options: { dryRun }, stepsOptions: { tag } } = this
      const { fetch, sign } = { ...tag, ...options }
      const logger = this.logger.createChild('tag')
      
      if (this.shouldSkip('tag')) {
        logger.info('Skipping tag.')
        return
      }
      
      logger.info('Tagging version...')
      
      if (fetch) {
        logger.verbose('Fetching fresh tags from the remote repository...')
        
        if (!dryRun) {
          await gitFetch([ '--tags' ])
        }
      }
      
      const tags = await project.getTags()
      this.state.tags = tags.length > 0
      
      if (!this.state.tags) {
        logger.info('No version changes detected.')
        return
      }
      
      logger.verbose(`Tags to create:`)
      
      for (const tag of tags) {
        logger.verbose(`- ${ tag }`)
        
        if (!dryRun) {
          await gitTag([ sign ? '--sign' : '--annotate', '--message', tag, tag ])
        }
      }
    })
  }
  
  push(options?: ReleaserPushOptions): this {
    return this.enqueue(async () => {
      const { options: { dryRun }, state, stepsOptions: { push } } = this
      const { force } = { ...push, ...options }
      const logger = this.logger.createChild('push')
      
      if (this.shouldSkip('push')) {
        logger.info('Skipping push.')
        return
      }
      
      const branch = await gitBranchCurrent()
      
      logger.info(`Pushing changes to "${ branch }"...`)
      
      if (!state.bump && !state.tags) {
        logger.info('Nothing to push.')
        return
      }
      
      if (!dryRun) {
        if (state.bump) {
          await gitPushBranch('origin', branch, [
            ...when(force, '--force'),
            '--no-verify',
          ])
        }
        
        if (state.tags) {
          await gitPush([ 'origin', '--tags', '--no-verify' ])
        }
      }
    })
  }
  
  publish(options?: PickOverridableOptions<P['publish']>): this {
    return this.enqueue(async () => {
      const { project, options: { dryRun }, stepsOptions: { publish } } = this
      const logger = this.logger.createChild('publish')
      
      if (this.shouldSkip('publish')) {
        logger.info('Skipping publish.')
        return
      }
      
      logger.info('Publishing...')
      
      const tagsMap = await project.getDefaultPublishTag()
      const name = await project.manifest.getName()
      // monorepo independent 模式下为 undefined
      const tag = tagsMap.get(name)
      
      await project.publish({
        dryRun,
        logger,
        tag,
        ...publish,
        ...options,
      })
    })
  }
  
  release(option?: PickOverridableOptions<G['createRelease']>): this {
    const { hosting } = this
    
    if (!hosting) {
      throwError('Hosting service is not configured. Please set the hosting option.')
    }
    
    return this.enqueue(async () => {
      const { project, options: { dryRun }, stepsOptions: { release } } = this
      const logger = this.logger.createChild('release')
      
      if (this.shouldSkip('release')) {
        logger.info('Skipping release.')
        return
      }
      
      logger.info('Creating release...')
      
      await hosting.createRelease({
        project,
        dryRun,
        logger,
        ...release,
        ...option,
      })
    })
  }
  
  pullRequest(option?: PickOverridableOptions<G['createPullRequest']>): this {
    const { hosting } = this
    
    if (!hosting) {
      throwError('Hosting service is not configured. Please set the hosting option.')
    }
    
    return this.enqueue(async () => {
      const { project, state, options: { dryRun }, stepsOptions: { pullRequest } } = this
      const logger = this.logger.createChild('pull-request')
      
      if (this.shouldSkip('pullRequest')) {
        logger.info('Skipping pull request.')
        return
      }
      
      logger.info('Creating pull request...')
      
      if (!state.bump) {
        logger.info('No version changes detected, skipping pull request creation.')
        return
      }
      
      if (!state.headBranch) {
        logger.info('Head branch is not set, skipping pull request creation.')
        return
      }
      
      await hosting.createPullRequest({
        project,
        dryRun,
        logger,
        from: state.headBranch,
        to: await this.getBaseBranch(),
        ...pullRequest,
        ...option,
      })
    })
  }
  
  async run(condition?: (releaser: this) => Promise<boolean>): Promise<void> {
    let shouldRun = true
    
    if (condition) {
      const logger = this.logger.createChild('run')
      
      logger.info('Checking condition...')
      
      shouldRun = await condition(this)
      
      if (shouldRun) {
        logger.info('Condition passed, running release steps...')
      } else {
        logger.info('Condition failed, skipping release steps.')
      }
    }
    
    if (shouldRun) {
      for (const fn of this.queue) {
        await fn()
      }
    }
    
    const logger = this.logger.createChild('done')
    this.queue.length = 0
    logger.info(`Done!`)
  }
  
  protected shouldSkip(step: ReleaserStep): boolean {
    return this.skippedSteps[step] === true
  }
  
  private async getBaseBranch(): Promise<string> {
    const { state: { baseBranch } } = this
    
    if (baseBranch) {
      return baseBranch
    }
    
    return gitBranchCurrent()
  }
}
