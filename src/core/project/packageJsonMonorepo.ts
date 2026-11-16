import { normalizePath } from '@peiyanlu/node-utils'
import { type Simplify, throwError } from '@peiyanlu/ts-utils'
import { isAbsolute, join } from 'node:path'
import { PackageJsonManifest } from '../manifest/index.ts'
import { MonorepoProject } from './monorepo.ts'
import { PackageJsonProject } from './packageJson.ts'
import type { PackageJsonMonorepoProjectOptions } from './packageJsonMonorepo.types.ts'
import type { ProjectPublishOptions } from './project.types.ts'


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
    throwError('Publishing a package.json monorepo project is not supported.')
  }
}
