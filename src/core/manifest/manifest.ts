import type { Dict } from '@peiyanlu/ts-utils'
import { dirname } from 'node:path'
import { prerelease } from 'semver'
import type { ProjectManifestVersionUpdate } from './manifest.types.js'


export abstract class ProjectManifest<T = Dict> {
  static Filename: string
  
  projectDir: string
  
  abstract contents?: string
  abstract manifest?: T
  
  constructor(public filepath: string) {
    this.projectDir = dirname(filepath)
  }
  
  abstract readManifest(): Promise<T>
  
  abstract getName(): Promise<string>
  
  abstract getVersion(): Promise<string>
  
  abstract isPrivate(): Promise<boolean>
  
  abstract writeVersion(versin: string, dryRun?: boolean): Promise<ProjectManifestVersionUpdate>
  
  async getPrereleaseVersion(): Promise<readonly (string | number)[] | null> {
    const version = await this.getVersion()
    return prerelease(version)
  }
}
