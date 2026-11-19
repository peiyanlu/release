import { normalizePath, readTextFile, writeTextFile } from '@peiyanlu/node-utils'
import { isBlankString, isZero, newline, type OptionalOrComplete } from '@peiyanlu/ts-utils'
import { ConventionalChangelog, type Preset } from 'conventional-changelog'
import createPreset from 'conventional-changelog-conventionalcommits'
import { Bumper, type Preset as BumpPreset } from 'conventional-recommended-bump'
import { createWriteStream, existsSync } from 'node:fs'
import { join } from 'node:path'
import { finished } from 'node:stream/promises'
import type { ReleaseType } from 'semver'
import type { ChangelogOptions } from './changelog.types.ts'
import { defaultTypes } from './committype.ts'
import { headerPartial, preamblePartial, template } from './templates.ts'


export type VersionBumpType = Extract<ReleaseType, 'major' | 'minor' | 'patch'>


export class Changelog {
  constructor(public options: ChangelogOptions = {}) {}
  
  get infile(): string {
    const { pkgDir = '.', filename = 'CHANGELOG.md' } = this.options
    return normalizePath(join(pkgDir, filename))
  }
  
  setOptions(options: ChangelogOptions): void {
    Object.assign(this.options, options)
  }
  
  parsePreset(): Preset {
    const { transformTypes, scope } = this.options
    
    const types = transformTypes?.(defaultTypes) ?? defaultTypes
    
    return createPreset({ types, scope })
  }
  
  async inferReleaseType(): Promise<OptionalOrComplete<{ releaseType: VersionBumpType, reason: string }>> {
    const { pkgDir, tagPrefix } = this.options ?? {}
    const preset = this.parsePreset() as BumpPreset
    
    const res = await new Bumper()
      .config(preset)
      .commits({ path: pkgDir })
      .tag({ prefix: tagPrefix })
      .bump(preset.whatBump)
    
    if (!('releaseType' in res)) return {}
    
    const { releaseType, reason } = res
    
    return { releaseType, reason }
  }
  
  createGenerator(): ConventionalChangelog {
    const { pkgDir = '.', tagPrefix = 'v', releaseCount = 1 } = this.options
    const { preamble, version, previousTag } = this.options
    
    return new ConventionalChangelog()
      .readPackage(`${ pkgDir }/package.json`)
      .config(this.parsePreset())
      .options({ releaseCount })
      .commits({ path: pkgDir })
      .tags({ prefix: tagPrefix })
      .readRepository()
      .context({ preamble, version, previousTag })
      .writer({
        preamblePartial,
        headerPartial,
        template,
      })
  }
  
  async read(): Promise<string> {
    const generator = this.createGenerator()
    
    let content: string = ''
    for await (const chunk of generator.write()) {
      content += chunk
    }
    
    return content.trimEnd()
  }
  
  async write(): Promise<string> {
    const { infile, options } = this
    const { releaseCount = 1 } = options
    
    if (!existsSync(infile)) await writeTextFile(infile, '')
    const existsContent = await readTextFile(infile)
    
    const writeStream = createWriteStream(infile)
    const generator = this.createGenerator()
    
    let content: string = ''
    for await (const chunk of generator.write()) {
      content += chunk
      writeStream.write(chunk)
    }
    
    const override = isZero(releaseCount)
    const firstWrite = isBlankString(existsContent) || override
    
    if (!firstWrite) {
      writeStream.write(newline())
      writeStream.write(existsContent)
    }
    
    writeStream.end()
    
    await finished(writeStream)
    
    return content.trimEnd()
  }
}
