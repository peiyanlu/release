import { DeepRequired } from '@peiyanlu/ts-utils'
import { CommitType } from './git/changetype.js'


export interface ReleaseContext {
  dryRun: boolean
  isCI: boolean
  release: boolean
  showChangelog: boolean
  showRelease: boolean
  noGit: boolean
  noNpm: boolean
  noGitHub: boolean
  increment: string
  isIncrement: boolean
  configFileExists: boolean
  pkg: {
    name: string
    isPrivate: boolean
    publishConfig: {
      access: string
      registry: string
      [key: string]: string
    }
    current: string
    fromPreRelease: boolean
    next: string
    toPreRelease: boolean
    preId: string
    preBase: '0' | '1' | false
  }
  npm: {
    username: string
    otp: string
    tag: string
  },
  git: {
    remoteName: string
    remoteUrl: string
    latestTag: string
    previousTag: string
    currentTag: string
    isCommitted: boolean
    isTagged: boolean
    commitMessage: string
    tagMessage: string
    tagName: string
  },
  github: {
    username: string
    owner: string
    repo: string
    changelog: string
    isWeb: boolean
    isReleased: boolean
    releaseId: number
    releaseUrl: string
    uploadUrl: string
    discussionUrl: string
    token: string
    releaseName: string
  }
}


export type HookTiming = 'before' | 'after'

export type HookAction = 'bump' | 'publish' | 'push' | 'release'

export type ReleaseHookKey = `${ HookTiming }:${ HookAction }`

export type ReleaseHookValue = string | string[] | (() => Promise<void> | void)

export type HookConfig = {
  [key in ReleaseHookKey]: ReleaseHookValue
}

export interface ReleaseConfig {
  /**
   * 生命周期钩子配置
   */
  hooks: HookConfig
  
  /**
   * Git 相关配置
   */
  git: {
    /**
     * 是否创建提交
     */
    commit: boolean | undefined
    
    /**
     * 是否创建 Git Tag
     */
    tag: boolean | undefined
    
    /**
     * 是否推送到远程仓库
     */
    push: boolean | undefined
    
    /**
     * Git 提交信息模板
     */
    commitMessage: string
    
    /**
     * 额外的 git commit 参数
     */
    commitArgs: string[]
    
    /**
     * Git Tag 的消息内容
     */
    tagMessage: string
    
    /**
     * Git Tag 名称模板
     */
    tagName: string
    
    /**
     * 额外的 git tag 参数
     */
    tagArgs: string[]
    
    /**
     * 额外的 git push 参数
     */
    pushArgs: string[]
    
    /**
     * 是否自动添加未追踪的文件
     */
    addUntrackedFiles: boolean
    
    /**
     * 是否要求配置远程仓库
     */
    requireRemote: boolean
    
    /**
     * 是否要求当前目录为 Git 仓库
     */
    requireRepository: boolean
    
    /**
     * 是否要求工作目录保持干净（无未提交的更改）
     */
    requireWorkDirClean: boolean
  }
  
  /**
   * NPM 发布相关配置
   */
  npm: {
    /**
     * 是否发布到 npm
     */
    publish: boolean | undefined
    
    /**
     * 发布目录路径
     */
    publishPath: string
    
    /**
     * 额外的 npm publish 参数
     */
    pushArgs: string[]
    
    /**
     * 是否跳过发布前检查
     */
    skipChecks: boolean
  }
  
  /**
   * GitHub Release 相关配置
   */
  github: {
    /**
     * 是否创建 GitHub Release
     */
    release: boolean | undefined
    
    /**
     * Release 展示名称
     */
    releaseName: string
    
    /**
     * 是否自动生成 Release Notes (CI)
     */
    autoGenerate: boolean
    
    /**
     * 是否标记为预发布版本
     */
    prerelease: boolean
    
    /**
     * 是否创建为草稿
     */
    draft: boolean
    
    /**
     * GitHub Token 引用名称
     */
    tokenRef: string
    
    /**
     * 需要上传的 Release 资源文件
     */
    assets: string[]
    
    /**
     * 是否跳过 GitHub 发布前检查
     */
    skipChecks: boolean
  }
  
  /**
   * Changelog 生成相关配置
   */
  changelog: {
    /**
     * Changelog 输入文件路径
     */
    infile: string
    
    /**
     * 用于生成 Changelog 的提交类型映射规则
     */
    types: CommitType[]
  }
}

export type DefaultConfig = ReleaseConfig

export type ResolvedConfig = DeepRequired<ReleaseConfig>
