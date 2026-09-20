import { normalizePath } from '@peiyanlu/node-utils'
import { type Simplify, throwError } from '@peiyanlu/ts-utils'
import { isAbsolute, join } from 'path'
import { PackageJsonManifest } from '../manifest/index.js'
import { MonorepoProject } from './monorepo.js'
import { PackageJsonProject } from './packageJson.js'
import type { PackageJsonMonorepoProjectOptions } from './packageJsonMonorepo.types.js'
import type { ProjectPublishCheckOptions, ProjectPublishOptions } from './project.types.js'


/**
 * 基于 package.json 的单体仓库项目。
 */
export class PackageJsonMonorepoProject extends MonorepoProject {
  constructor(options: Simplify<PackageJsonMonorepoProjectOptions>) {
    const { root = process.cwd(), getProjects } = options
    
    super({
      ...options,
      manifest: new PackageJsonManifest(normalizePath(join(root, PackageJsonManifest.Filename))),
      async* getProjects(options) {
        for await (const path of getProjects(options)) {
          yield new PackageJsonProject({
            path: isAbsolute(path) ? path : normalizePath(join(root, path)),
            ...options,
          })
        }
      },
    })
  }
  
  override publish(_options?: ProjectPublishOptions): Promise<void> {
    throwError('Publishing a package.json monorepo project is not supported')
  }
  
  override publishCheck(_options?: ProjectPublishCheckOptions): Promise<void> {
    throwError('Publishing a package.json monorepo project is not supported')
  }
}
