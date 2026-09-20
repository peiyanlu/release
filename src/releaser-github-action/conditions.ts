import { context } from '@actions/github'
import { gitFetch, gitLog } from '@peiyanlu/cli-utils'
import { isCommandComment } from './comment.js'
import type { ReleaserGithubAction } from './releaser.js'


export const ifReleaseCommit = async (releaser: ReleaserGithubAction): Promise<boolean> => {
  const { project, options: { dryRun } } = releaser
  const logger = releaser.logger.createChild('if-release-commit')
  
  const message = await gitLog([ '-1', '--pretty=%B' ])
  
  if (!message?.startsWith('chore(release):')) {
    logger.verbose('Skipping non-release commit.')
    return false
  }
  
  logger.verbose('Checking existing release tags...')
  
  if (!dryRun) {
    await gitFetch([ '--tags' ])
  }
  
  const tags = await project.getTags()
  const canRelease = tags.length > 0
  
  if (canRelease) {
    logger.verbose(`Found release tags:`)
    for (const tag of tags) {
      logger.verbose(`- ${ tag }`)
    }
  } else {
    logger.verbose(`No release tags found.`)
  }
  
  return canRelease
}

/**
 * 检测当前事件是否为针对处于打开状态的发布拉取请求的受支持命令评论：
 * （`!release/set-options` 或 `!release/set-preamble`）
 *
 * @returns 如果是此类评论，则返回 `目标分支`；如果是评论事件但不是命令评论，则返回 `false`；如果根本不是评论事件，则返回 `null`
 */
export const ifCommandComment = (): string | false | null => {
  const { eventName, payload: { issue, comment } } = context
  
  if (eventName !== 'issue_comment') {
    return null
  }
  
  const isPullRequest = issue?.pull_request as unknown
  const issueAuthor = (issue?.user as { login: string } | undefined)?.login
  const issueBody = issue?.body
  const issueState = issue?.state as string
  const commentBody = (comment as { body?: string } | undefined)?.body
  
  if (isPullRequest
    && issueAuthor === 'github-actions[bot]'
    && issueState === 'open'
    && issueBody?.includes('release-pull-request: true')
    && isCommandComment(commentBody)
  ) {
    const matches = issueBody.match(/release-branch-to:\s*(\S+)/)
    return matches ? matches[1] : false
  }
  
  return false
}
