import type { ProjectOptions } from './project.types.ts'


export interface PackageJsonProjectOptions extends Omit<ProjectOptions, 'manifest'> {
  /**
   * package.json 文件的路径。
   */
  path?: string
}
