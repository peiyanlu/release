import { eol, runGit } from '@peiyanlu/cli-utils'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'path'
import { getGithubUrl } from '../github/release.js'
import { ReleaseContext, ResolvedConfig } from '../types.js'
import { findType, mergeTypes } from './changetype.js'
import { getLog } from './commit.js'


export const getCommits = async (isIncrement?: boolean) => {
  const raw = await getLog(false, isIncrement)
  return raw?.split('\n').filter(Boolean)
}

export const parseCommit = (message: string) => {
  // const match = message.match(/^(\*\s+)?(\w+):\s(.+)\s\((\w{7})\)$/)
  const match = message.match(/^(\w+):\s(.+)\s(\w{7})\s(\w{40})$/)
  if (!match) return
  
  return {
    type: match[1],
    description: match[2],
    hash: match[3],
    fullHash: match[4],
  }
}

export const classify = (commits: string[]) => {
  const sections: Record<string, string[][]> = {}
  
  for (const msg of commits) {
    const parsed = parseCommit(msg)
    if (!parsed) continue
    const { type, description, hash, fullHash } = parsed
    ;(sections[type] ??= []).push([ description, hash, fullHash ])
  }
  
  return sections
}

export const renderChangelog = async (ctx: ReleaseContext, sections: Record<string, string[][]>) => {
  const { github: { owner, repo }, git: { latestTag, currentTag } } = ctx
  
  const date = new Date().toISOString().split('T')[0]
  const github = getGithubUrl(owner, repo)
  
  const title = latestTag
    ? `## [${ currentTag }](${ github }/compare/${ latestTag }...${ currentTag }) (${ date })`
    : `## ${ currentTag } (${ date })`
  
  const content = Object
    .entries(sections)
    .map(entry => {
      const [ type, items ] = entry
      const title = `### ${ findType(type) }`
      const content = items.map(item => {
        const [ desc, hash, fullHash ] = item
        return `* **${ type }** ${ desc } [${ hash }](${ github }/commit/${ fullHash })`
      }).join(eol(1))
      return [ title, content ].join(eol(2))
    })
    .join(eol(2))
  
  
  const footer = latestTag
    ? `**Full Changelog**: ${ github }/compare/${ latestTag }...${ currentTag }`
    : ''
  
  return [ title, content, footer ].join(eol(3))
}

export const generateChangelog = async (ctx: ReleaseContext) => {
  const { isIncrement } = ctx
  const commits = await getCommits(isIncrement)
  if (!commits) return ''
  
  const classified = classify(commits!)
  const changelog = await renderChangelog(ctx, classified)
  
  Object.assign(ctx.github, { changelog })
  
  return changelog
}

export const updateChangelog = async (file: string, newContent: string) => {
  const infile = file || 'CHANGELOG.md'
  const target = join(process.cwd(), infile)
  const SHORT_TITLE = '# Changelog'
  
  const exist = (existsSync(target) ? (await readFile(target, 'utf-8')) : '').replace(/\r\n/g, '\n')
  const hasTitle = exist.startsWith(SHORT_TITLE)
  const old = hasTitle ? exist.slice(SHORT_TITLE.length) : exist
  
  const final = [ SHORT_TITLE, newContent, old ].map(k => k.trim()).join(eol(4))
  const output = final + eol()
  
  await writeFile(target, output)
  await runGit([ 'add', infile ])
}


export const writeChangelog = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { changelog: { infile, types } } = config
  
  mergeTypes(types)
  const newContent = await generateChangelog(ctx)
  await updateChangelog(infile, newContent)
}
