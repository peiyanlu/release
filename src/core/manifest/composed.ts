import type { Dict } from '@peiyanlu/ts-utils'
import { ProjectManifest } from './manifest.js'
import type { ProjectManifestVersionUpdate } from './manifest.types.js'


export class ComposedProjectManifest<T = Dict> extends ProjectManifest<T> {
  constructor(
    public mainManifest: ProjectManifest<T>,
    public subManifests: ProjectManifest[],
  ) {
    super(mainManifest.filepath)
  }
  
  get contents(): string | undefined {
    return this.mainManifest.contents
  }
  
  get manifest(): T | undefined {
    return this.mainManifest.manifest
  }
  
  readManifest(): Promise<T> {
    return this.mainManifest.readManifest()
  }
  
  getName(): Promise<string> {
    return this.mainManifest.getName()
  }
  
  getVersion(): Promise<string> {
    return this.mainManifest.getVersion()
  }
  
  isPrivate(): Promise<boolean> {
    return this.mainManifest.isPrivate()
  }
  
  async writeVersion(version: string, dryRun?: boolean): Promise<ProjectManifestVersionUpdate> {
    const update = await this.mainManifest.writeVersion(version, dryRun)
    
    for (let sub of this.subManifests) {
      const { files } = await sub.writeVersion(version, dryRun)
      update.files.push(...files)
    }
    
    return update
  }
}
