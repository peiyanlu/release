import { context } from '@actions/github'
import { gitFetch, gitLog } from '@peiyanlu/cli-utils'
import { isCommandComment } from './comment.js'
import type { ReleaserGithubAction } from './releaser.js'


export const ifReleaseCommit = async (releaser: ReleaserGithubAction): Promise<boolean> => {
  const { project, options: { dryRun } } = releaser
  const message = await gitLog([ '-1', '--pretty=%B' ])
  
  if (!message?.startsWith('chore(release):')) {
    return false
  }
  
  if (!dryRun) {
    await gitFetch([ '--tags' ])
  }
  
  const tags = await project.getTags()
  
  return tags.length > 0
}

/**
 * 检测当前事件是否为针对处于打开状态的发布拉取请求的受支持命令评论：
 * （`!release/set-options` 或 `!release/set-preamble`）
 *
 * @returns 如果是此类评论，则返回 `目标分支`；如果是评论事件但不是命令评论，则返回 `false`；如果根本不是评论事件，则返回 `null`
 */
export const ifCommandComment = (): string | false | null => {
  const { eventName, payload: { issue, comment } } = context
  const isPullRequest = issue?.pull_request as unknown
  const issueAuthor = (issue?.user as { login: string } | undefined)?.login
  const issueBody = issue?.body
  const issueState = issue?.state as string
  const commentBody = (comment as { body?: string } | undefined)?.body
  
  if (eventName === 'issue_comment') {
    if (isPullRequest
      && issueAuthor === 'github-actions[bot]'
      && issueState === 'open'
      && issueBody?.includes('release-pull-request: true')
      && isCommandComment(commentBody)
    ) {
      const matches = issueBody.match(/release-branch-to:\s*(\S+)/)
      
      if (matches) {
        return matches[1]
      }
    }
    
    return false // 不是拉取请求评论，停止操作
  }
  
  return null // 继续
}


// function shouldContinue() {
//   const { eventName, payload: { issue, comment } } = context
//  
//   // push 等非评论事件：继续执行
//   if (eventName !== 'issue_comment') return true
//  
//   // 评论事件：仅允许符合条件的发布 PR 命令评论
//   return Boolean(
//     issue?.pull_request
//     && issue.user?.login === 'github-actions[bot]'
//     && issue.state === 'open'
//     && issue.body?.includes('release-pull-request: true')
//     && issue.body?.match(/release-branch-to:\s*(\S+)/)
//     && comment?.body?.includes('!release/set-options'),
//   )
// }
//
// core.setOutput('continue', String(shouldContinue()))
