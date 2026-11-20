import { concatStringStream, normalizePath, writeTextFile } from '@peiyanlu/node-utils'
import { isZero, type OptionalOrComplete } from '@peiyanlu/ts-utils'
import { ConventionalChangelog, type Preset } from 'conventional-changelog'
import createPreset from 'conventional-changelog-conventionalcommits'
import { Bumper, type Preset as BumpPreset } from 'conventional-recommended-bump'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ReleaseType } from 'semver'
import type { ChangelogOptions, ChangelogPresetOptions } from './changelog.types.ts'
import { defaultTypes } from './committype.ts'
import { addReleaseNotes } from './utils.ts'
import { type ExtraTemplateContext, headerPartial, preamblePartial, template } from './templates.ts'


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
    const { transformTypes, scope } = this.options as ChangelogPresetOptions
    
    const types = transformTypes?.(defaultTypes) ?? defaultTypes
    
    return createPreset({ types, scope })
  }
  
  async inferReleaseType(): Promise<OptionalOrComplete<{ releaseType: VersionBumpType, reason: string }>> {
    const { pkgDir, tagPrefix } = this.options
    const preset = this.parsePreset() as BumpPreset
    
    const res = await new Bumper()
      .config(preset)
      .commits({ path: pkgDir })
      .tag({ prefix: tagPrefix })
      .bump(preset.whatBump)
    
    if (!('releaseType' in res)) return {}
    
    return res
  }
  
  createGenerator(): ConventionalChangelog {
    const { pkgDir = '.', tagPrefix = 'v', releaseCount = 1 } = this.options
    const { preamble, version, previousTag, breakingSync } = this.options
    
    return new ConventionalChangelog()
      .readPackage(`${ pkgDir }/package.json`)
      .config(this.parsePreset())
      .options({ releaseCount })
      .commits({ path: pkgDir })
      .tags({ prefix: tagPrefix })
      .readRepository()
      .context({ preamble, version, previousTag, breakingSync } as ExtraTemplateContext)
      .writer({
        preamblePartial,
        headerPartial,
        template,
      })
  }
  
  async read(): Promise<string> {
    return concatStringStream(this.createGenerator().write())
  }
  
  async write(): Promise<string> {
    const { infile, options } = this
    const { releaseCount = 1 } = options
    
    if (!existsSync(infile) || isZero(releaseCount)) {
      await writeTextFile(infile, '')
    }
    
    return addReleaseNotes(infile, this.createGenerator().write())
  }
}
