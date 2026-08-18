import { eol } from '@peiyanlu/cli-utils'
import { isZero, type Simplify } from '@peiyanlu/ts-utils'
import { ConventionalChangelog, type Options, type Preset } from 'conventional-changelog'
import type { CommitType } from 'conventional-changelog-conventionalcommits'
import createPreset from 'conventional-changelog-conventionalcommits'
import { Bumper, type Preset as BumpPreset } from 'conventional-recommended-bump'
import { createWriteStream, existsSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { finished } from 'node:stream/promises'
import { defaultTypes } from './changetype.js'
import { headerPartial, preamblePartial, template } from './templates.js'


interface GenerateOptions {
  /** @example () => `packages/${pkg}` */
  getPkgDir: () => string;
  /** @example `${pkg}@` */
  tagPrefix?: string;
  /** 生成多少个变更日志，详见 {@link Options} */
  releaseCount?: number;
}

interface ParsePresetOptions {
  /** 生成 CHANGELOG 时包含默认隐藏的 commit 类型 */
  includeHidden?: boolean
  /** 对默认 commit types 进行转换 */
  transformTypes?: (types: CommitType[]) => CommitType[]
  /** commit scope */
  scope?: string | string[]
}

type GOptions = Simplify<GenerateOptions & ParsePresetOptions>


type ReleaseType = 'major' | 'minor' | 'patch'

type InferReleaseTypeResult<T extends boolean | undefined> =
  T extends true
    ? { releaseType: ReleaseType; reason: string } | undefined
    : ReleaseType | undefined


export const parsePreset = (options: ParsePresetOptions = {}): Preset => {
  const { includeHidden, transformTypes, scope } = options
  
  let types = [ ...defaultTypes ]
  
  if (includeHidden) {
    types.forEach(type => {
      if (type.effect === 'hidden') {
        type.effect = 'changelog'
      }
    })
  }
  
  types = transformTypes?.(types) ?? types
  
  const preset: Preset = createPreset({ types, scope })
  
  preset.writer ??= {}
  preset.writer.preamblePartial = preamblePartial
  preset.writer.headerPartial = headerPartial
  preset.writer.template = template
  
  return preset
}

export const inferReleaseType = async <T extends boolean = false>(
  options?: ParsePresetOptions & { json?: T },
): Promise<InferReleaseTypeResult<T>> => {
  const preset = parsePreset(options) as BumpPreset
  const res = await new Bumper().config(preset).bump(preset.whatBump)
  
  if (!('releaseType' in res)) return undefined as InferReleaseTypeResult<T>
  
  const { releaseType, reason } = res
  
  return (options?.json ? { releaseType, reason } : releaseType) as InferReleaseTypeResult<T>
}


export const createGenerator = async (options: GOptions): Promise<ConventionalChangelog> => {
  const { getPkgDir, tagPrefix, releaseCount = 1, includeHidden, transformTypes, scope } = options
  
  const pkgDir = getPkgDir()
  return new ConventionalChangelog()
    .readPackage(`${ pkgDir }/package.json`)
    .config(parsePreset({ includeHidden, transformTypes, scope }))
    .options({ releaseCount })
    .commits({ path: pkgDir })
    .tags({ prefix: tagPrefix })
}

export const getChangelog = async (options: GOptions): Promise<string> => {
  const generator = await createGenerator(options)
  
  let changelog: string = ''
  for await (const chunk of generator.write()) {
    changelog += chunk
  }
  
  return changelog.trimEnd()
}

export const generateChangelog = async (options: GOptions): Promise<void> => {
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
