import { PackageJsonProject, type PackageJsonProjectOptions, type ProjectBumpOptions } from '../core/index.ts'
import { publish, type PublishOptions } from './publish.ts'


export type NpmProjectOptions = PackageJsonProjectOptions

export type NpmProjectBumpOptions = ProjectBumpOptions

export type NpmProjectPublishOptions = PublishOptions


/** 一个基于 npm 的项目，使用 package.json 进行配置 */
export class NpmProject extends PackageJsonProject {
  override async publish(options: NpmProjectPublishOptions = {}): Promise<void> {
    await publish(this, { ...options })
  }
}
