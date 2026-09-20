import type { ProjectOptions } from './project.types.js'


export interface PackageJsonProjectOptions extends Omit<ProjectOptions, 'manifest'> {
  /**
   * package.json 文件的路径。
   */
  path?: string
}
