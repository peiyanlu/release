import type { GetProjectsOptions, MonorepoMode, MonorepoProjectOptions } from './monorepo.types.js'


export interface PackageJsonMonorepoProjectOptions extends Omit<MonorepoProjectOptions, 'getProjects' | 'manifest'> {
  mode: MonorepoMode
  /**
   * 单体仓库的根目录。
   */
  root?: string
  
  /**
   * 获取单体仓库中各项目的 package.json。
   */
  getProjects(options: GetProjectsOptions): AsyncIterable<string>
}
