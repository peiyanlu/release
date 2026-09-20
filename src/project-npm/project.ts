import { getAuthenticatedUser, getPublishedVersion, hasWriteAccess, pingRegistry } from '@peiyanlu/cli-utils'
import { assert } from '@peiyanlu/ts-utils'
import {
  ChildLogger,
  PackageJsonProject,
  type PackageJsonProjectOptions,
  type ProjectBumpOptions, type ProjectPublishCheckOptions,
} from '../core/index.js'
import { check } from './check.js'
import { publish, type PublishOptions } from './publish.js'


export type NpmProjectOptions = PackageJsonProjectOptions

export type NpmProjectBumpOptions = ProjectBumpOptions

export type NpmProjectPublishOptions = Omit<PublishOptions, 'workspaces'>


/** 一个基于 npm 的项目，使用 package.json 进行配置 */
export class NpmProject extends PackageJsonProject {
  override async publish(options: NpmProjectPublishOptions = {}): Promise<void> {
    const { skip, logger } = options
    
    if (skip) {
      logger?.info('Skipping publish.')
      return
    }
    
    const tagsMap = await this.getDefaultPublishTag()
    const name = await this.manifest.getName()
    const tag = tagsMap.get(name)
    
    await publish(this, { tag, ...options })
  }
  
  override async publishCheck(options: ProjectPublishCheckOptions= {}): Promise<void> {
    await check(this, options)
  }
}
