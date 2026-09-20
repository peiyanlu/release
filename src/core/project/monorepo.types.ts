import type { Simplify } from '@peiyanlu/ts-utils'
import type { ProjectManifest } from '../manifest/manifest.js'
import { Project } from './project.js'
import type { ProjectBumpOptions, ProjectOptions } from './project.types.js'


export type MonorepoMode = 'fixed' | 'independent'

export type GetProjectsOptions = Simplify<Required<Pick<ProjectOptions, 'compose' | 'manifest'>>>

export interface MonorepoProjectOptions extends ProjectOptions {
  /**
   * 单体仓库的版本模式。
   * `fixed` 表示所有项目统一升级到同一版本；`independent` 表示各项目分别升级版本。
   */
  mode: MonorepoMode
  
  /**
   * 用于组合 package.json 的钩子函数。
   */
  compose?(packageJson: ProjectManifest, isRoot?: boolean): ProjectManifest
  
  /**
   * 获取单体仓库中的项目。
   */
  getProjects(options: GetProjectsOptions): AsyncIterable<Project>
  
  /**
   * 获取单体仓库中项目的 scope。
   * @param projectName - 要获取 scope 的项目名称。
   * @param rootName - 根项目名称。
   * @returns 项目的 scope。
   */
  scope?(projectName: string, rootName: string): string | Promise<string>
  
  /**
   * 获取单体仓库中项目的标签前缀。
   * @param scope - 项目的 scope 名称。
   * @returns 项目的标签前缀。
   */
  tagPrefix?(scope: string): string | Promise<string>
}

type NextVersionKeys = 'skip' | 'version' | 'as' | 'prerelease' | 'snapshot' | 'firstRelease'
type BumpKeys = 'skipChangelog' | 'releaseCount' | 'preamble' | 'transformTypes'

export type MonorepoProjectBumpByProjectOptions = Pick<ProjectBumpOptions, NextVersionKeys | BumpKeys>

export interface MonorepoProjectBumpOptions extends Omit<ProjectBumpOptions, 'tagPrefix'> {
  /**
   * 在固定版本模式下，强制升级单体仓库中没有变更的项目。
   */
  force?: boolean
  /**
   * 要纳入项目变更日志的额外 scope。
   * 例如，要纳入 `fix(deps): 修复依赖项漏洞` 这类提交，可将 `deps` 添加到 `extraScopes`。
   */
  extraScopes?: string[]
  /**
   * 针对特定项目的版本升级选项。
   */
  byProject?: Record<string, MonorepoProjectBumpByProjectOptions>
}
