import { eol } from '@peiyanlu/cli-utils'
import { normalizePath } from '@peiyanlu/node-utils'
import { isBlankString, isZero, tryCallSync } from '@peiyanlu/ts-utils'
import { ConventionalChangelog, type Preset } from 'conventional-changelog'
import createPreset from 'conventional-changelog-conventionalcommits'
import { Bumper, type Preset as BumpPreset } from 'conventional-recommended-bump'
import { createWriteStream, existsSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { finished } from 'node:stream/promises'
import { join } from 'path'
import type { ChangelogOptions } from './changelog.types.js'
import { defaultTypes } from './committype.js'
import { headerPartial, preamblePartial, template } from './templates.js'


const versionHeaderRegex = /^#+ (?:<small>)?\[?([^[\]()\s]*\d+\.\d+\.\d+[^[\]()\s]*)]?(?:<\/small>)?/m
const tagsRegex = /\/([^/)]*)\.\.\.([^/)]*)\)/


const decodeTag = (tag: string) => {
  return tryCallSync(() => decodeURIComponent(tag), tag)
}


interface LastRelease {
  version: string;
  notes: string;
  previousTag: string;
  nextTag: string;
}

export const extractLastRelease = async (input: string | string[] | Iterable<string> | AsyncIterable<string | Buffer>): Promise<LastRelease> => {
  let stream = input
  let inLastChanges = false
  let notes = ''
  let chunk: Buffer | string
  let lines: string[]
  let line: string
  let previousTag = ''
  let nextTag = ''
  let version = ''
  
  if (typeof stream === 'string') {
    stream = [ stream ]
  }
  
  top: for await (chunk of stream) {
    lines = chunk.toString('utf8').split(/\n/)
    
    for (line of lines) {
      const versionMatch = line.match(versionHeaderRegex)
      
      if (versionMatch) {
        if (inLastChanges) {
          break top
        }
        
        [ , version ] = versionMatch
        inLastChanges = true
        
        const tagsMatch = line.match(tagsRegex)
        
        if (tagsMatch) {
          // 标签从比较链接中提取，可能经过 URL 编码。
          previousTag = decodeTag(tagsMatch[1])
          nextTag = decodeTag(tagsMatch[2])
        }
        
        continue
      }
      
      if (inLastChanges) {
        notes += `${ line }\n`
      }
    }
  }
  
  return {
    version,
    notes: notes.trim(),
    previousTag,
    nextTag,
  }
}

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
  
  async inferReleaseType(): Promise<{ releaseType?: undefined, reason?: undefined } | {
    releaseType: 'major' | 'minor' | 'patch',
    reason: string
  }> {
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
    
    if (!existsSync(infile)) await writeFile(infile, '')
    const exist = readFileSync(infile, 'utf-8')
    const writeStream = createWriteStream(infile)
    
    const generator = this.createGenerator()
    
    let content: string = ''
    for await (const chunk of generator.write()) {
      content += chunk
      writeStream.write(chunk)
    }
    
    const override = isZero(releaseCount)
    const firstWrite = isBlankString(exist) || override
    
    if (!firstWrite) {
      writeStream.write(eol())
      writeStream.write(exist)
    }
    
    writeStream.end()
    
    await finished(writeStream)
    
    return content.trimEnd()
  }
}
