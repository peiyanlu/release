import { type Simplify, throwError } from '@peiyanlu/ts-utils'
import { PackageJsonManifest } from '../manifest/index.js'
import type { PackageJsonProjectOptions } from './packageJson.types.js'
import { Project } from './project.js'
import type { ProjectPublishCheckOptions, ProjectPublishOptions } from './project.types.js'


export class PackageJsonProject extends Project {
  constructor(options: Simplify<PackageJsonProjectOptions> = {}) {
    const { path = PackageJsonManifest.Filename } = options
    
    super({
      ...options,
      manifest: new PackageJsonManifest(path),
    })
  }
  
  override publish(_options?: ProjectPublishOptions): Promise<void> {
    throwError('Publishing a package.json project is not supported')
  }
  
  override publishCheck(_options?: ProjectPublishCheckOptions): Promise<void> {
    throwError('Publishing a package.json project is not supported')
  }
}
