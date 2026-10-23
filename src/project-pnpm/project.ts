import { PackageJsonProject, type PackageJsonProjectOptions, type ProjectBumpOptions } from '../core/index.js'
import { publish, type PublishOptions } from './publish.js'


export type PnpmProjectOptions = PackageJsonProjectOptions

export type PnpmProjectBumpOptions = ProjectBumpOptions

export type PnpmProjectPublishOptions = PublishOptions


/** 一个基于 pnpm 的项目，使用 package.json 进行配置 */
export class PnpmProject extends PackageJsonProject {
  override async publish(options: PnpmProjectPublishOptions = {}): Promise<void> {
    await publish(this, { ...options })
  }
}
