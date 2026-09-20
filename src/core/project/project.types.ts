import type { ReleaseType } from 'semver'
import type { ChangelogOptions } from '../changelog/index.js'
import type { ChildLogger } from '../logger.js'
import type { ProjectManifestVersionUpdate } from '../manifest/index.js'
import type { ProjectManifest } from '../manifest/manifest.js'


export type TagPrefixResolver = (scope: string) => string | Promise<string>

export interface ProjectOptions {
  changelogFile?: string
  manifest: ProjectManifest
  tagPrefix?: string | TagPrefixResolver
  
  compose?(manifest: ProjectManifest): ProjectManifest
}

interface ProjectTagPrefixOptions {
  /**
   * 标签前缀。
   * @default 'v'
   */
  tagPrefix?: string
}

interface ProjectSkipOptions {
  /**
   * 跳过
   */
  skip?: boolean
}

export interface ProjectVersionUpdate extends ProjectManifestVersionUpdate {
  notes: string
}

export interface ProjectTagsOptions extends ProjectTagPrefixOptions {
  verify?: boolean
}

export interface ProjectReleaseOptions extends ProjectTagPrefixOptions {}

export interface ProjectMaintenanceBranchesOptions extends ProjectReleaseOptions {
  /**
   * 维护分支名称的前缀。
   * 默认使用标签前缀。
   */
  branchPrefix?: string
}

export interface ProjectMaintenanceBranch {
  /**
   * 创建分支所基于的源标签。
   */
  from: string
  /**
   * 要创建的目标分支名称。
   */
  to: string
}

export interface ProjectNextVersionOptions extends ProjectTagPrefixOptions {
  skip?: boolean
  /**
   * 忽略项目为私有项目这一限制。
   */
  forcePrivate?: boolean
  /**
   * 强制升级到指定版本。
   * 未提供时，根据提交记录确定版本。
   */
  version?: string
  /**
   * 用于计算升级版本的基准版本。
   * 未提供时，从清单文件中读取版本。
   */
  baseVersion?: string
  /**
   * 要升级到的发布类型。
   * 未提供时，根据提交记录确定版本。
   */
  as?: ReleaseType
  /**
   * 要使用的预发布标识符。
   */
  prerelease?: string
  /**
   * 快照预发布标识符，版本号末尾会附加时间戳。
   */
  snapshot?: string
  /**
   * 是否为首次发布。
   * 默认根据标签是否存在自动判断。
   */
  firstRelease?: boolean
}

type ProjectBumpChangelogOptions = Pick<ChangelogOptions, 'releaseCount' | 'preamble' | 'transformTypes'>

export interface ProjectBumpOptions extends ProjectNextVersionOptions, ProjectBumpChangelogOptions {
  /** 跳过变更日志生成 */
  skipChangelog?: boolean
  
  /**
   * 是否仅试运行。
   * 为 `true` 时，不会将版本写入清单文件，只在内存中更新。
   */
  dryRun?: boolean
  
  logger?: ChildLogger
}

export interface ProjectRevertOptions {
  dryRun?: boolean
  logger?: ChildLogger
}

export interface ProjectPublishOptions {
  dryRun?: boolean
  logger?: ChildLogger
  /** 跳过发布 */
  skip?: boolean
  /** 发布通道标签。由具体项目类型解释，例如 npm dist-tag 或 GitHub Action 分支别名。 */
  tag?: string
}

export interface ProjectPublishCheckOptions {
  logger?: ChildLogger
  /** 跳过检查 */
  skip?: boolean
}
