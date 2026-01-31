import { log } from '@clack/prompts'
import { DeepRequired } from '@peiyanlu/ts-utils'


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
  selectedPkg: string
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
    isPushed: boolean
    commitMessage: string
    tagMessage: string
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


export type Logger = typeof log

export type HookTiming = 'before' | 'after'

export type HookAction = 'bump' | 'publish' | 'push' | 'release'

export type ReleaseHookKey = `${ HookTiming }:${ HookAction }`

export type ReleaseHookValue = string | string[] | ((logger: Logger) => Promise<void> | void)

export type HookConfig = {
  [key in ReleaseHookKey]: ReleaseHookValue
}

export interface ReleaseConfig {
  /**
   * 生命周期钩子配置
   * 用于在 Release 关键阶段注入自定义逻辑（如 before/after hooks）。
   */
  hooks: HookConfig
  
  /** 是否是 monorepo */
  isMonorepo: boolean
  
  /** 使用 monorepo 时发布的包列表，后续回调的 `pkg`。默认为 `[]` 作为单仓库 */
  packages: string[]
  
  /** 使用 monorepo 时使用 getPkgDir，例如 `packages/${pkg}`。 默认为 `.` 作为单仓库 */
  getPkgDir: (pkg: string) => string
  
  /** 使用 monorepo 时使用 toTag，例如 `${pkg}@${version}`，默认为 `v${version}` 作为单仓库 */
  toTag: (pkg: string, version: string) => string
  
  /** 作为 CHANGELOG 标题的 Tag 前缀，多包场景下需要 `${pkg}@` */
  tagPrefix: ((pkg: string) => string | undefined) | undefined
  
  /**
   * Git 相关配置
   * 影响提交、打 tag、推送等本地/远程 Git 行为。
   */
  git: {
    /**
     * 是否创建 Git 提交
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
     * 额外的 git commit 参数（透传给 git CLI）
     */
    commitArgs: string[]
    
    /**
     * Git Tag 的消息内容
     */
    tagMessage: string
    
    /**
     * 额外的 git tag 参数（透传给 git CLI）
     */
    tagArgs: string[]
    
    /**
     * 额外的 git push 参数（透传给 git CLI）
     */
    pushArgs: string[]
    
    /**
     * 是否自动添加未追踪的文件（git add -A）
     */
    addUntrackedFiles: boolean
    
    /**
     * 是否要求必须配置远程仓库（存在 git remote）
     */
    requireRemote: boolean
    
    /**
     * 是否要求当前工作目录必须是 Git 仓库
     */
    requireRepository: boolean
    
    /**
     * 是否要求工作目录保持干净（无未提交的更改）
     */
    requireWorkDirClean: boolean
  }
  
  /**
   * NPM 发布相关配置
   * 影响 npm publish 的目标路径、参数与前置校验。
   */
  npm: {
    /**
     * 是否启用 npm 发布流程
     */
    publish: boolean | undefined
    
    /**
     * 额外的 npm publish 参数（透传给 npm CLI）
     */
    publishArgs: string[]
    
    /**
     * 是否跳过发布前检查（如 ping、whoami 等校验）
     */
    skipChecks: boolean
  }
  
  /**
   * GitHub Release 相关配置
   * 控制是否创建 Release、发布方式以及上传资源。
   */
  github: {
    /**
     * 是否创建 GitHub Release
     */
    release: boolean | undefined
    
    /**
     * Release 展示名称（标题）
     */
    releaseName: string
    
    /**
     * 是否由 GitHub 自动生成 Release Notes（通常用于 CI）
     */
    autoGenerate: boolean
    
    /**
     * 是否标记为预发布版本（pre-release）
     */
    prerelease: boolean
    
    /**
     * 是否创建为草稿（draft）
     */
    draft: boolean
    
    /**
     * GitHub Token 引用名称（用于从环境变量或配置中读取）
     */
    tokenRef: string
    
    /**
     * 需要上传到 Release 的资源文件列表
     */
    assets: string[]
    
    /**
     * 是否跳过 GitHub 发布前检查
     */
    skipChecks: boolean
  }
}

export type DefaultConfig = ReleaseConfig

export type ResolvedConfig = DeepRequired<ReleaseConfig>
