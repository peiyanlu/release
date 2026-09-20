import type { PackageJsonProjectOptions, ProjectBumpOptions, ProjectPublishCheckOptions } from '../core/index.js'
import { PackageJsonProject } from '../core/index.js'
import { check } from '../project-npm/check.js'
import { publish, type PublishOptions } from './publish.js'


export type PnpmProjectOptions = PackageJsonProjectOptions

export type PnpmProjectBumpOptions = ProjectBumpOptions

export type PnpmProjectPublishOptions = Omit<PublishOptions, 'workspaces'>


/** 一个基于 pnpm 的项目，使用 package.json 进行配置 */
export class PnpmProject extends PackageJsonProject {
  override async publish(options: PnpmProjectPublishOptions = {}): Promise<void> {
    const { skip, logger } = options
    
    if (skip) {
      logger?.info('Skipping publish.')
      return
    }
    
    const tagsMap = await this.getDefaultPublishTag()
    const name = await this.manifest.getName()
    const tag = tagsMap.get(name)
    
    await publish(this, { tag,...options })
  }
  
  override async publishCheck(options: ProjectPublishCheckOptions = {}): Promise<void> {
    await check(this, options)
  }
}
