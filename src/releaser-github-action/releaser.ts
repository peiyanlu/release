import type { getOctokit } from '@actions/github'
import type { Octokit } from '@octokit/rest'
import { gitBranchCurrent, gitFetch, gitRevParse } from '@peiyanlu/cli-utils'
import { type Dict, isEmpty, isNotEmpty, isNull, isUndefined, type Simplify, throwError } from '@peiyanlu/ts-utils'
import type {
  MonorepoProjectBumpOptions,
  PickOverridableOptions,
  Project,
  ReleaserCheckoutOptions,
  ReleaserOptions,
  ReleaserPushOptions,
  ReleaserSetUserOptions,
  ReleaserTagOptions,
} from '../core/index.js'
import { Releaser } from '../core/releaser.js'
import { GithubHosting } from '../hosting-github/github.js'
import { parseSetOptionsComment, parseSetPreambleComment } from './comment.js'
import { ifCommandComment, ifReleaseCommit } from './conditions.js'


export interface ReleaserGithubActionOptions<P extends Project = Project> extends Omit<ReleaserOptions<P, GithubHosting>, 'hosting'> {
  /** 用于进行 GitHub API 调用的 Octokit 实例 */
  octokit: ReturnType<typeof getOctokit>
}


export class ReleaserGithubAction<P extends Project = Project> extends Releaser<P, GithubHosting> {
  declare readonly hosting: GithubHosting
  
  override setUser(options: ReleaserSetUserOptions = {}): this {
    return super.setUser({
      username: 'github-actions[bot]',
      email: 'github-actions[bot]@users.noreply.github.com',
      ...options,
    })
  }
  
  override checkout(options: ReleaserCheckoutOptions = {}): this {
    return super.checkout({
      fetch: true,
      force: true,
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
  
  constructor(options: Simplify<ReleaserGithubActionOptions<P>>) {
    super({
      hosting: new GithubHosting({
        octokit: options.octokit as Octokit,
      }),
      ...options,
    })
  }
  
  fetchOptions(): this {
    return this.enqueue(async () => {
      const { state: { headBranch }, stepsOptions: { bump: bumpOpts } } = this
      
      if (!headBranch) {
        throwError('Head branch is not set. Please call `checkout` before `fetchParams`.')
      }
      
      const { project, hosting } = this
      const logger = this.logger.createChild('fetch-options')
      
      logger.info('Fetching options from pull request comments...')
      
      const { octokit } = hosting
      const [ owner, repo ] = await hosting.getRepositoryId(project)
      
      const { data: [ pr ] } = await octokit.rest.pulls.list({
        owner,
        repo,
        head: `${ owner }:${ headBranch }`,
        state: 'open',
      })
      
      if (!pr) {
        logger.info('No open pull request found.')
        return
      }
      
      const { data: comments } = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: pr.number,
      })
      
      let optionsApplied = false
      let preamble: string | undefined
      const preambleByName = new Map<string, string>()
      
      for (let i = comments.length, comment; i >= 0; i--) {
        comment = comments[i]
        
        if (!optionsApplied) {
          const json = parseSetOptionsComment(comment)
          
          if (json) {
            try {
              const options = JSON.parse(json) as Dict
              
              logger.verbose('Found set-options comment:')
              logger.verbose(json)
              
              this.setOptions(options)
              
              // 只有在选项成功应用后才停止扫描；最新评论格式错误时，继续查找更早的有效评论。
              optionsApplied = true
            } catch {
              logger.verbose('Failed to parse parameters comment:')
              logger.verbose(json)
            }
            
            continue
          }
        }
        
        const setPreamble = parseSetPreambleComment(comment)
        
        if (setPreamble) {
          const { name, preamble: markdown } = setPreamble
          
          if (name) {
            if (!preambleByName.has(name)) {
              preambleByName.set(name, markdown)
            }
          } else if (isUndefined(preamble)) {
            preamble = markdown
          }
        }
      }
      
      if (isEmpty(preamble) && isEmpty(preambleByName)) {
        return
      }
      
      const bump: MonorepoProjectBumpOptions = { ...bumpOpts }
      
      if (isNotEmpty(preamble)) {
        logger.verbose('Found global set-preamble comment.')
        bump.preamble = preamble
      }
      
      if (isNotEmpty(preambleByName)) {
        for (const [ name, markdown ] of preambleByName) {
          ;(bump.byProject ??= {})[name] = {
            ...bump.byProject?.[name],
            preamble: markdown,
          }
        }
      }
      
      this.setOptions({
        bump: bump as PickOverridableOptions<P['bump']>,
      })
    })
  }
  
  fetch(): this {
    return this.enqueue(async () => {
      const { logger, options: { dryRun } } = this
      
      logger.info('fetch', 'Fetching all commits and tags from the remote repository...')
      
      if (!dryRun) {
        const isShallow = (await gitRevParse([ '--is-shallow-repository' ])) === 'true'
        const unshallow = isShallow ? [ '--unshallow' ] : []
        
        await gitFetch([ '--prune', '--tags', ...unshallow, '--', 'origin', 'HEAD' ])
      }
    })
  }
  
  async runPullRequestAction(): Promise<void> {
    await this
      .setUser()
      .checkout()
      .fetchOptions()
      .bump()
      .commit()
      .push()
      .pullRequest()
      .run()
  }
  
  async runReleaseAction(check = true): Promise<void> {
    await this
      .setUser()
      .maintenanceBranch()
      .tag()
      .push()
      .publish()
      .release()
      .run(check ? ifReleaseCommit : undefined)
  }
  
  async runSnapshotAction(snapshotTag: string): Promise<void> {
    if (!snapshotTag) {
      throwError('Snapshot tag is required.')
    }
    
    await this
      .fetch()
      .bump({
        snapshot: snapshotTag,
        skipChangelog: true,
      } as PickOverridableOptions<P['bump']>)
      .publish({
        tag: snapshotTag,
      } as PickOverridableOptions<P['publish']>)
      .revert()
      .run()
  }
  
  async runAction(): Promise<void> {
    const logger = this.logger.createChild('run')
    
    logger.info('Detecting action...')
    
    const commandComment = ifCommandComment()
    let isReleaseCommit = false
    
    if (commandComment === false) {
      logger.info('Action triggered by a pull request comment.')
      logger.info('No command comment found in a comment. Stopping action.')
      return
    }
    
    if (!isNull(commandComment)) {
      logger.info('Action triggered by a pull request comment.')
      
      const currentBranch = await gitBranchCurrent()
      
      if (currentBranch !== commandComment) {
        this.checkout({
          branch: commandComment,
          fetch: true,
          force: false,
        })
      }
    } else {
      isReleaseCommit = await ifReleaseCommit(this)
    }
    
    if (isReleaseCommit) {
      logger.info('Running release action...')
      await this.runReleaseAction(false)
    } else {
      logger.info('Running pull request action...')
      await this.runPullRequestAction()
    }
  }
}
