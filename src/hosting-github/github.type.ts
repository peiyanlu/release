import { Octokit } from '@octokit/rest'
import type { CreatePullRequestOptions } from '../core/index.js'


export interface GithubOptions {
  /**
   * 用于通过 GitHub API 进行身份验证的 GitHub Personal Access Token。
   */
  token?: string
  /**
   * 用于发起 API 请求的 GitHub Octokit 实例。
   */
  octokit?: Octokit
  /**
   * GitHub 仓库的所有者（用户名或组织）。
   * 如果未提供，则会从远程仓库 URL 中自动推断。
   */
  owner?: string
  /**
   * 用于创建 Release 的 GitHub 项目（仓库）名称。
   * 如果未提供，则会从远程仓库 URL 中自动推断。
   */
  repo?: string
}

export interface GithubCreatePullRequestOptions extends CreatePullRequestOptions {
  draft?: boolean
}

export interface UploadAssetsOptions {
  owner: string
  repo: string
  release_id: number
  assets: string[]
}

export interface WebRelease {
  owner: string
  repo: string
  tag: string
  title: string
  body: string
  prerelease: string
}

export interface GetReleaseOptions {
  owner: string
  repo: string
  tag: string
}

export type RepositoryId = [ owner: string, repo: string ]

export interface ListPullRequestOptions {
  owner: string
  repo: string
  from: string
}
