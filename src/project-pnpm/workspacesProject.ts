import { normalizePath } from '@peiyanlu/node-utils'
import { readFileSync } from 'node:fs'
import { join } from 'path'
import { globSync } from 'tinyglobby'
import { parse } from 'yaml'
import type {
  GetProjectsOptions,
  PackageJsonMonorepoProjectOptions,
  ProjectBumpOptions,
  ProjectPublishCheckOptions,
} from '../core/index.js'
import { PackageJsonManifest, PackageJsonMonorepoProject } from '../core/index.js'
import { check } from '../project-npm/check.js'
import { publish, type PublishOptions } from './publish.js'


export type PnpmWorkspacesProjectOptions = Omit<PackageJsonMonorepoProjectOptions, 'getProjects'>

export type PnpmWorkspacesProjectBumpOptions = ProjectBumpOptions

export type PnpmWorkspacesProjectPublishOptions = Omit<PublishOptions, 'workspaces'>

const getPackagesGlobPatterns = async (filepath: string) => {
  const { packages = [] } = parse(readFileSync(filepath, 'utf8'))
  
  return packages as string[]
}

const getProjects = async function* (options: GetProjectsOptions) {
  const { manifest: { projectDir } } = options
  const workspaceFile = join(projectDir, PnpmWorkspacesProject.WorkspaceFile)
  const packages = await getPackagesGlobPatterns(workspaceFile)
  
  for (const pkg of packages) {
    const matched = globSync(
      normalizePath(join(pkg, PackageJsonManifest.Filename)),
      {
        cwd: projectDir,
        onlyFiles: true,
        absolute: true,
        ignore: PnpmWorkspacesProject.GlobIgnore,
      },
    )
    
    for (const filepath of matched) {
      yield filepath
    }
  }
}

/** 一个基于 pnpm 工作区的单体仓库项目，使用 package.json 和 pnpm-workspace.yaml 进行配置 */
export class PnpmWorkspacesProject extends PackageJsonMonorepoProject {
  static WorkspaceFile: string = 'pnpm-workspace.yaml'
  static GlobIgnore: string[] = [ '**/node_modules/**' ]
  
  constructor(options: PnpmWorkspacesProjectOptions) {
    super({
      ...options,
      getProjects,
    })
  }
  
  override async publish(options: PnpmWorkspacesProjectPublishOptions = {}): Promise<void> {
    const { skip, logger } = options
    
    if (skip) {
      logger?.info('Skipping publish.')
      return
    }
    
    const tagsMap = await this.getDefaultPublishTag()
    
    if (this.isFixedMode) {
      const name = await this.manifest.getName()
      const tag = tagsMap.get(name)
      
      await publish(this, {
        tag,
        ...options,
        workspaces: true,
      })
    } else {
      for await (const project of this.getProjects()) {
        if (project.hasBump) {
          const name = await project.manifest.getName()
          const tag = tagsMap.get(name)
          
          await publish(project, {
            tag,
            ...options,
            workspaces: false,
          })
        }
      }
    }
  }
  
  override async publishCheck(options: ProjectPublishCheckOptions = {}): Promise<void> {
    await check(this, options)
  }
}
