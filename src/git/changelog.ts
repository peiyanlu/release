import { eol } from '@peiyanlu/cli-utils'
import { isZero } from '@peiyanlu/ts-utils'
import { ConventionalChangelog, type Options, type Preset } from 'conventional-changelog'
import type { CommitType } from 'conventional-changelog-conventionalcommits'
import createPreset from 'conventional-changelog-conventionalcommits'
import { Bumper, type Preset as BumpPreset } from 'conventional-recommended-bump'
import { createWriteStream, existsSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { finished } from 'node:stream/promises'
import { defaultTypes } from './changetype.js'
import { headerPartial, template } from './templates.js'


interface GenerateOptions {
  /** @example () => `packages/${pkg}` */
  getPkgDir: () => string;
  /** @example `${pkg}@` */
  tagPrefix?: string;
  /** 生成多少个变更日志，详见 {@link Options} */
  releaseCount?: number;
}

export interface ParsePresetOptions {
  /** 生成 CHANGELOG 时包含默认隐藏的 commit 类型 */
  includeHidden?: boolean
  /** 对默认 commit types 进行转换 */
  transformTypes?: (types: CommitType[]) => CommitType[]
}


export const parsePreset = (options: ParsePresetOptions = {}) => {
  const { includeHidden, transformTypes } = options
  
  let types = [ ...defaultTypes ]
  
  if (includeHidden) {
    types.forEach(type => {
      if (type.effect === 'hidden') {
        type.effect = 'changelog'
      }
    })
  }
  
  types = transformTypes?.(types) ?? types
  
  const preset: Preset = createPreset({ types })
  
  preset.writer ??= {}
  preset.writer.headerPartial = headerPartial
  preset.writer.template = template
  
  return preset
}

export const inferReleaseType = async (options?: ParsePresetOptions) => {
  const preset = parsePreset(options) as BumpPreset
  const res = await new Bumper().bump(preset.whatBump)
  return 'releaseType' in res ? res.releaseType : undefined
}

export const createGenerator = async (options: GenerateOptions & ParsePresetOptions) => {
  const { getPkgDir, tagPrefix, releaseCount = 1, includeHidden, transformTypes } = options
  
  const pkgDir = getPkgDir()
  return new ConventionalChangelog()
    .readPackage(`${ pkgDir }/package.json`)
    .config(parsePreset({ includeHidden, transformTypes }))
    .options({ releaseCount })
    .commits({ path: pkgDir })
    .tags({ prefix: tagPrefix })
}


export const getChangelog = async (options: GenerateOptions & ParsePresetOptions) => {
  const generator = await createGenerator(options)
  
  let changelog: string = ''
  for await (const chunk of generator.write()) {
    changelog += chunk
  }
  
  return changelog.trimEnd()
}

export const generateChangelog = async (options: GenerateOptions & ParsePresetOptions) => {
  const { getPkgDir, releaseCount = 1 } = options
  
  const pkgDir = getPkgDir()
  const infile = join(pkgDir, 'CHANGELOG.md')
  
  if (!existsSync(infile)) await writeFile(infile, '')
  const exist = readFileSync(infile, 'utf-8')
  const writeStream = createWriteStream(infile)
  
  const generator = await createGenerator(options)
  for await (const chunk of generator.write()) {
    writeStream.write(chunk)
  }
  
  const override = isZero(releaseCount)
  const firstWrite = isZero(exist.trim().length) || override
  
  if (!firstWrite) {
    writeStream.write(eol())
    writeStream.write(exist)
  }
  
  writeStream.end()
  
  await finished(writeStream)
}
