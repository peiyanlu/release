import { eol } from '@peiyanlu/cli-utils'
import { ConventionalChangelog, type Preset } from 'conventional-changelog'
import createPreset from 'conventional-changelog-conventionalcommits'
import { createWriteStream, existsSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { finished } from 'node:stream/promises'
import { join } from 'path'
import { defaultTypes } from './changetype.js'


interface Options {
  /** @example () => `packages/${pkg}` */
  getPkgDir: () => string;
  /** @example `${pkg}@` */
  tagPrefix?: string;
}


export const generateChangelog = async ({ getPkgDir, tagPrefix }: Options) => {
  const pkgDir = getPkgDir()
  const infile = join(pkgDir, 'CHANGELOG.md')
  
  if (!existsSync(infile)) await writeFile(infile, '')
  const originalChangelog = readFileSync(infile, 'utf-8')
  
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
{{/each}}`.trim() + eol(2)
  
  const generator = new ConventionalChangelog()
    .readPackage(`${ pkgDir }/package.json`)
    .config(preset)
    .options({ releaseCount: 1 })
    .commits({ path: pkgDir })
    .tags({ prefix: tagPrefix })
  
  const writeStream = createWriteStream(infile)
  
  let changelog: string = ''
  for await (const chunk of generator.write()) {
    changelog += chunk
    writeStream.write(chunk)
  }
  
  writeStream.write(originalChangelog)
  writeStream.end()
  
  await finished(writeStream)
  
  return changelog
}
