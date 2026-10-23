import type { CreatePullRequestOptions, CreateReleaseOptions } from './hosting.types.js'


/** Git 仓库托管服务的基类 */
export abstract class GitRepositoryHosting {
  /** 为提供的项目创建 release */
  abstract createRelease(options: CreateReleaseOptions): Promise<void>
  
  /** 未提供的项目创建 pull request */
  abstract createPullRequest(options: CreatePullRequestOptions): Promise<void>
}
