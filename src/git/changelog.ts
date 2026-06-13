import { eol } from '@peiyanlu/cli-utils'
import { isZero } from '@peiyanlu/ts-utils'
import { ConventionalChangelog, type Options, type Preset } from 'conventional-changelog'
import createPreset from 'conventional-changelog-conventionalcommits'
import { createWriteStream, existsSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { finished } from 'node:stream/promises'
import { defaultTypes } from './changetype.js'


interface GenerateOptions {
  /** @example () => `packages/${pkg}` */
  getPkgDir: () => string;
  /** @example `${pkg}@` */
  tagPrefix?: string;
  /** 生成多少个变更日志，详见 {@link Options} */
  releaseCount?: number;
}

export const parsePreset = async () => {
  const preset: Preset = await createPreset({
    types: defaultTypes.map((t) => ({ ...t, hidden: false })),
  })
  preset.writer ??= {}
  
  preset.writer.headerPartial = `
## {{#if isPatch~}} <small> {{~/if~}}
{{#if @root.linkCompare~}}
[{{version}}](
{{~#if @root.repository~}}
  {{~#if @root.host}}
    {{~@root.host}}/
  {{~/if}}
  {{~#if @root.owner}}
    {{~@root.owner}}/
  {{~/if}}
  {{~@root.repository}}
{{~else}}
  {{~@root.repoUrl}}
{{~/if~}}
/compare/{{previousTag}}...{{currentTag}})
{{~else}}
{{~version}}
{{~/if}}
{{~#if title}} "{{title}}"
{{~/if}}
{{~#if date}} ({{date}})
{{~/if}}
{{~#if isPatch~}} </small> {{~/if}}
`.trim() + eol()
  
  preset.writer.mainTemplate = `
{{> header}}
{{#if noteGroups}}
{{#each noteGroups}}

### ⚠ {{title}}

{{#each notes}}
* {{#if commit.scope}}**{{commit.scope}}:** {{/if}}{{commit.subject}} {{#if commit.hash}}([{{commit.shortHash}}](https://github.com/{{@root.owner}}/{{@root.repository}}/commit/{{commit.hash}})){{/if}}
{{/each}}
{{/each}}
{{/if}}
{{#each commitGroups}}

{{#if title}}
### {{title}}

{{/if}}
{{#each commits}}
{{> commit root=@root}}
{{/each}}
{{/each}}`.trim()
  
  return preset
}

export const createGenerator = async ({ getPkgDir, tagPrefix, releaseCount = 1 }: GenerateOptions) => {
  const pkgDir = getPkgDir()
  
  const preset: Preset = await parsePreset()
  
  return new ConventionalChangelog()
    .readPackage(`${ pkgDir }/package.json`)
    .config(preset)
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
  
  return changelog
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
