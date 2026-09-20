import type { AnyFunction } from '@peiyanlu/ts-utils'
import type { GitRepositoryHosting } from './hosting/hosting.js'
import type { Logger } from './logger.js'
import type { Project } from './project/project.js'


export type PickOverridableOptions<T extends AnyFunction> = Partial<
  Omit<
    Exclude<Parameters<T>[0], undefined>,
    'dryRun' | 'logger' | 'tagPrefix' | 'project'
  >
>


export interface ReleaserOptions<
  P extends Project = Project,
  G extends GitRepositoryHosting = GitRepositoryHosting
> {
  /**
   * 要发布的项目。
   */
  project: P
  /**
   * 用于创建 Release 和拉取请求的 Git 仓库托管服务。
   */
  hosting?: G
  dryRun?: boolean
  silent?: boolean
  verbose?: boolean
  logger?: Logger
}

export interface ReleaserCheckoutOptions {
  branch?: string
  /**
   * 如果分支已存在，则删除并重新创建。
   */
  force?: boolean
  /**
   * 强制从远程仓库获取所有提交和标签。
   */
  fetch?: boolean
}

export interface ReleaserSetUserOptions {
  /**
   * 设置 Git 用户名。
   */
  username?: string
  /**
   * 设置 Git 用户邮箱。
   */
  email?: string
}

export interface ReleaserCommitOptions {
  sign?: boolean
  allowEmpty?: boolean
}

export interface ReleaserTagOptions {
  sign?: boolean
  /** 在创建标签之前，从远程仓库获取最新的标签 */
  fetch?: boolean
}

export interface ReleaserPushOptions {
  /** 强制推送分支 */
  force?: boolean
}

export interface ReleaserMaintenanceBranchOptions {
  /** 强制创建分支 */
  force?: boolean
  /** 启用维护分支创建 */
  enabled?: boolean
}


export interface ReleaserStepsOptions<
  P extends Project = Project,
  G extends GitRepositoryHosting = GitRepositoryHosting
> {
  setUser?: ReleaserSetUserOptions
  maintenanceBranch?: ReleaserMaintenanceBranchOptions
  checkout?: ReleaserCheckoutOptions
  bump?: PickOverridableOptions<P['bump']>
  commit?: ReleaserCommitOptions
  tag?: ReleaserTagOptions
  push?: ReleaserPushOptions
  publish?: PickOverridableOptions<P['publish']>
  release?: PickOverridableOptions<G['createRelease']>
  pullRequest?: PickOverridableOptions<G['createPullRequest']>
}

export type ReleaserStep = keyof ReleaserStepsOptions
export type ReleaserSkipOptions = Partial<Record<ReleaserStep, boolean>>
