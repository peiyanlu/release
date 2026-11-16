import { type Simplify, throwError } from '@peiyanlu/ts-utils'
import { PackageJsonManifest } from '../manifest/index.ts'
import type { PackageJsonProjectOptions } from './packageJson.types.ts'
import { Project } from './project.ts'
import type { ProjectPublishOptions } from './project.types.ts'


export class PackageJsonProject extends Project {
  constructor(options: Simplify<PackageJsonProjectOptions> = {}) {
    const { path = PackageJsonManifest.Filename } = options
    
    super({
      ...options,
      manifest: new PackageJsonManifest(path),
    })
  }
  
  override publish(_options?: ProjectPublishOptions): Promise<void> {
    throwError('Publishing a package.json project is not supported.')
  }
}
