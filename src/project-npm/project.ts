import type { PackageJsonProjectOptions, ProjectBumpOptions, ProjectPublishCheckOptions } from '../core/index.js'
import { PackageJsonProject } from '../core/index.js'
import { check } from './check.js'
import { publish, type PublishOptions } from './publish.js'


export type NpmProjectOptions = PackageJsonProjectOptions

export type NpmProjectBumpOptions = ProjectBumpOptions

export type NpmProjectPublishOptions = PublishOptions


/** 一个基于 npm 的项目，使用 package.json 进行配置 */
export class NpmProject extends PackageJsonProject {
  override async publish(options: NpmProjectPublishOptions = {}): Promise<void> {
    await publish(this, { ...options })
  }
  
  override async publishCheck(options: ProjectPublishCheckOptions = {}): Promise<void> {
    await check(this, options)
  }
}
