import { readFile, writeFile } from 'node:fs/promises'
import { ProjectManifest } from './manifest.js'
import type { ProjectManifestVersionUpdate } from './manifest.types.js'
import type { PackageJsonProps } from './packageJson.types.js'


export class PackageJsonManifest<T extends PackageJsonProps = PackageJsonProps> extends ProjectManifest<T> {
  static override Filename = 'package.json'
  
  contents?: string
  manifest?: T
  
  async readManifest(): Promise<T> {
    if (!this.contentsMutex) {
      this.contentsMutex = readFile(this.filepath, 'utf-8')
      
      this.contents = await this.contentsMutex
      this.manifest = JSON.parse(this.contents) as T
      
      return this.manifest
    }
    
    await this.contentsMutex
    
    return this.manifest!
  }
  
  async getName(): Promise<string> {
    const { name } = await this.readManifest()
    return name
  }
  
  async getVersion(): Promise<string> {
    const { version } = await this.readManifest()
    return version
  }
  
  async isPrivate(): Promise<boolean> {
    const { private: isPrivate } = await this.readManifest()
    return Boolean(isPrivate)
  }
  
  async writeVersion(version: string, dryRun?: boolean): Promise<ProjectManifestVersionUpdate> {
    await this.readManifest()
    
    const { name, version: from } = this.manifest!
    
    this.manifest!.version = version
    this.contents = this.contents!.replace(
      /"version":(\s*)"[^"]+"/,
      `"version":$1"${ version }"`,
    )
    
    if (!dryRun) {
      await writeFile(this.filepath, this.contents, 'utf-8')
    }
    
    return {
      name,
      from,
      to: version,
      files: [ this.filepath ],
    }
  }
  
  private contentsMutex?: Promise<string>
}
