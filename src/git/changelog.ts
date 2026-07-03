import { eol } from '@peiyanlu/cli-utils'
import { isZero } from '@peiyanlu/ts-utils'
import { ConventionalChangelog, type Options, type Preset } from 'conventional-changelog'
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


export const parsePreset = () => {
  const preset: Preset = createPreset({
    types: defaultTypes,
  })
  
  preset.writer ??= {}
  preset.writer.headerPartial = headerPartial
  preset.writer.template = template
  
  return preset
}

export const inferReleaseType = async () => {
  const preset = parsePreset() as BumpPreset
  const res = await new Bumper().bump(preset.whatBump)
  return 'releaseType' in res ? res.releaseType : undefined
}

export const createGenerator = async ({ getPkgDir, tagPrefix, releaseCount = 1 }: GenerateOptions) => {
  const pkgDir = getPkgDir()
  
  return new ConventionalChangelog()
    .readPackage(`${ pkgDir }/package.json`)
    .config(parsePreset())
    .options({ releaseCount })
    .commits({ path: pkgDir })
    .tags({ prefix: tagPrefix })
}

export const getChangelog = async ({ getPkgDir, tagPrefix, releaseCount = 1 }: GenerateOptions) => {
  const generator = await createGenerator({ getPkgDir, tagPrefix, releaseCount })
  
  let changelog: string = ''
  for await (const chunk of generator.write()) {
    changelog += chunk
  }
  
  return changelog.trimEnd()
}

export const generateChangelog = async ({ getPkgDir, tagPrefix, releaseCount = 1 }: GenerateOptions) => {
  const pkgDir = getPkgDir()
  const infile = join(pkgDir, 'CHANGELOG.md')
  
  if (!existsSync(infile)) await writeFile(infile, '')
  const exist = readFileSync(infile, 'utf-8')
  const writeStream = createWriteStream(infile)
  
  const generator = await createGenerator({ getPkgDir, tagPrefix, releaseCount })
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
