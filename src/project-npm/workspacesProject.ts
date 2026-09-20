import { normalizePath } from '@peiyanlu/node-utils'
import { type Dict, onceAsync } from '@peiyanlu/ts-utils'
import { join } from 'path'
import { globSync } from 'tinyglobby'
import type {
  GetProjectsOptions,
  PackageJsonMonorepoProjectOptions,
  ProjectBumpOptions,
  ProjectPublishCheckOptions,
} from '../core/index.js'
import { PackageJsonManifest, PackageJsonMonorepoProject } from '../core/index.js'
import { check } from './check.js'
import { publish, type PublishOptions } from './publish.js'


export type NpmWorkspacesProjectOptions = Omit<PackageJsonMonorepoProjectOptions, 'getProjects'>

export type NpmWorkspacesProjectBumpOptions = ProjectBumpOptions

export type NpmWorkspacesProjectPublishOptions = PublishOptions


const getPackagesGlobPatterns = async (manifest: Promise<Dict>) => {
  const workspaces = (await manifest).workspaces as string[] | { packages?: string[] } | undefined
  
  return Array.isArray(workspaces)
    ? workspaces
    : workspaces?.packages ?? []
}

async function* getProjects(options: GetProjectsOptions) {
  const { manifest, manifest: { projectDir } } = options
  const packages = await getPackagesGlobPatterns(manifest.readManifest())
  
  for (const pkg of packages) {
    const matched = globSync(
      normalizePath(join(pkg, PackageJsonManifest.Filename)),
      {
        cwd: projectDir,
        onlyFiles: true,
        absolute: true,
        ignore: NpmWorkspacesProject.GlobIgnore,
      },
    )
    
    for (const filepath of matched) {
      yield filepath
    }
  }
}

/** 一个基于 npm workspaces 的 monorepo 项目，使用 package.json 的 workspaces 进行配置 */
export class NpmWorkspacesProject extends PackageJsonMonorepoProject {
  static GlobIgnore: string[] = [ '**/node_modules/**' ]
  
  constructor(options: NpmWorkspacesProjectOptions) {
    super({
      ...options,
      getProjects,
    })
  }
  
  override async publish(options: NpmWorkspacesProjectPublishOptions = {}): Promise<void> {
    const onceCall = onceAsync(this.getDefaultPublishTag.bind(this))
    
    for await (const project of this.getProjects()) {
      if (project.hasBump) {
        const opts = this.isFixedMode ? {} : await (async () => {
          const tagsMap = await onceCall()
          const name = await project.manifest.getName()
          const tag = tagsMap.get(name)
          return { tag }
        })()
        
        await publish(project, { ...opts, ...options })
      }
    }
  }
  
  override async publishCheck(options: ProjectPublishCheckOptions = {}): Promise<void> {
    await check(this, options)
  }
}
