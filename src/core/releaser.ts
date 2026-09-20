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
    const { logger } = this
    
    logger.verbose('set-options', 'Setting options for steps:')
    logger.verbose('set-options', options)
    
    for (const [ key, value ] of Object.entries(options)) {
      Object.assign(
        this.stepsOptions[key as keyof ReleaserStepsOptions] ??= {},
        value,
      )
    }
    
    logger.verbose('set-options', 'Final options for steps:')
    logger.verbose('set-options', this.stepsOptions)
    
    return this
  }
  
  setUser(options?: ReleaserSetUserOptions): this {
    return this.enqueue(async () => {
      const { logger, options: { dryRun }, stepsOptions: { setUser } } = this
      const { username, email } = { ...setUser, ...options }
      
      logger.info('set-user', 'Setting git user...')
      
      if (!username && !email) {
        logger.info('set-user', 'No git user configuration provided.')
        return
      }
      
      if (username) {
        logger.verbose('set-user', `Setting git user.name to "${ username }".`)
        
        if (!dryRun) {
          await gitConfigSet('user.name', username)
        }
      }
      
      if (email) {
        logger.verbose('set-user', `Setting git user.email to "${ email }".`)
        
        if (!dryRun) {
          await gitConfigSet('user.email', email)
        }
      }
    })
  }
  
  checkout(options: ReleaserCheckoutOptions = {}): this {
    return this.enqueue(async () => {
      const { logger, options: { dryRun }, stepsOptions: { checkout } } = this
      const { branch: headBranch = 'release-branch', fetch, force } = { ...checkout, ...options }
      
      logger.info('checkout', `Checking out branch ${ headBranch }...`)
      
      this.state.headBranch = headBranch
      this.state.baseBranch = await this.getBaseBranch()
      
      if (fetch) {
        logger.verbose('checkout', `Fetching all commits and tags from the remote repository...`)
        
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
        logger.verbose('checkout', `Force checking out branch ${ headBranch }...`)
        
        if (!dryRun) {
          await gitCheckoutBranchForce(headBranch)
        }
      } else {
        logger.verbose('checkout', `Checking out branch ${ headBranch }...`)
        
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
      const { project, logger, options: { dryRun }, state, stepsOptions: { commit } } = this
      const { sign, allowEmpty, skip } = { ...commit, ...options }
      
      if (skip) {
        logger.verbose('commit', 'Skipping commit.')
        return
      }
      
      logger.info('commit', `Committing changes...`)
      
      if (!state.bump) {
        logger.info('commit', 'No changes to commit.')
        return
      }
      
      const files = project.changedFiles
      const message = await project.getCommitMessage()
      
      logger.verbose('commit', `Files to commit:`)
      
      files.forEach((file) => {
        logger.verbose('commit', `- ${ file }`)
      })
      
      logger.verbose(
        'commit',
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
      const { project, logger, options: { dryRun }, stepsOptions: { maintenanceBranch } } = this
      const { enabled, force } = { ...maintenanceBranch, ...options }
      
      logger.info('maintenance-branch', 'Creating maintenance branches...')
      
      if (!enabled) {
        logger.info('maintenance-branch', 'Maintenance branch creation is disabled.')
        return
      }
      
      logger.verbose('maintenance-branch', 'Fetching fresh tags from the remote repository...')
      
      if (!dryRun) {
        await gitFetch([ '--tags' ])
      }
      
      const branches = await project.getMaintenanceBranches()
      
      if (!branches.length) {
        logger.info('maintenance-branch', 'No maintenance branches to create.')
        return
      }
      
      logger.verbose('maintenance-branch', 'Branches to create:')
      
      for (const { from, to } of branches) {
        logger.verbose('maintenance-branch', `- ${ to } from ${ from }`)
        
        if (dryRun) {
          continue
        }
        
        const branchExists = await gitRevParse([ '--verify', `refs/heads/${ to }` ])
          || await gitLsRemote([ '--heads', 'origin', to ])
        
        if (branchExists && !force) {
          logger.info('maintenance-branch', `Branch ${ to } already exists, skipping.`)
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
      const { project, logger, options: { dryRun }, stepsOptions: { tag } } = this
      const { fetch, sign, skip } = { ...tag, ...options }
      
      if (skip) {
        logger.verbose('tag', 'Skipping tag.')
        return
      }
      
      logger.info('tag', 'Tagging version...')
      
      if (fetch) {
        logger.verbose('tag', 'Fetching fresh tags from the remote repository...')
        
        if (!dryRun) {
          await gitFetch([ '--tags' ])
        }
      }
      
      const tags = await project.getTags()
      this.state.tags = tags.length > 0
      
      if (!this.state.tags) {
        logger.info('tag', 'No version changes detected.')
        return
      }
      
      logger.verbose('tag', `Tags to create:`)
      
      for (const tag of tags) {
        logger.verbose('tag', `- ${ tag }`)
        
        if (!dryRun) {
          await gitTag([ sign ? '--sign' : '--annotate', '--message', tag, tag ])
        }
      }
    })
  }
  
  push(options?: ReleaserPushOptions): this {
    return this.enqueue(async () => {
      const { logger, options: { dryRun }, state, stepsOptions: { push } } = this
      const { force, skip } = { ...push, ...options }
      
      if (skip) {
        logger.verbose('push', 'Skipping push.')
        return
      }
      
      const branch = await gitBranchCurrent()
      
      logger.info('push', `Pushing changes to "${ branch }"...`)
      
      if (!state.bump && !state.tags) {
        logger.info('push', 'Nothing to push.')
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
      
      const logger = this.logger.createChild('package')
      const publishOptions = { dryRun, logger, ...publish, ...options }
      
      if (publishOptions.skip) {
        logger.verbose('Skipping publish.')
        return
      }
      
      logger.info('Publishing...')
      
      await project.publish({ ...publishOptions })
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
      const { logger } = this
      
      logger.info('run', 'Checking condition...')
      
      shouldRun = await condition(this)
      
      if (shouldRun) {
        logger.info('run', 'Condition passed, running release steps...')
      } else {
        logger.info('run', 'Condition failed, skipping release steps.')
      }
    }
    
    if (shouldRun) {
      for (const fn of this.queue) {
        await fn()
      }
    }
    
    this.queue.length = 0
    this.logger.info('done', `Done!`)
  }
  
  private async getBaseBranch(): Promise<string> {
    const { state: { baseBranch } } = this
    
    if (baseBranch) {
      return baseBranch
    }
    
    return gitBranchCurrent()
  }
}
