import { concatStringStream, splitStream } from '@peiyanlu/node-utils'
import { isIndex, isString, tryCallSync } from '@peiyanlu/ts-utils'
import { createReadStream, createWriteStream } from 'fs'
import { existsSync } from 'node:fs'
import { rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { basename, dirname } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'


interface LastRelease {
  version: string;
  notes: string;
  previousTag: string;
  nextTag: string;
}


const decodeTag = (tag: string) => tryCallSync(() => decodeURIComponent(tag), tag)

const makeTempPath = (prefix: string, dir: string = tmpdir()) => {
  return join(dir, `${ prefix }-${ Math.random().toString(36).slice(2) }`)
}

const makeTempSiblingPath = (filepath: string) => {
  return makeTempPath(`.${ basename(filepath) }`, dirname(filepath))
}


export const versionHeaderRegex: RegExp = /^#+ (?:<small>)?\[?([^[\]()\s]*\d+\.\d+\.\d+[^[\]()\s]*)]?(?:<\/small>)?/m
export const tagsRegex: RegExp = /\/([^/)]*)\.\.\.([^/)]*)\)/

export const changelogHeader = `# Changelog

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.`


async function* insertReleaseNotes(changelog: AsyncIterable<string>, notes: string): AsyncIterable<string> {
  let isHeaderFound = false
  let isContentWritten = false
  // Not yet written tail: the last incomplete line and the trailing whitespace.
  let pending = ''
  
  for await (const chunk of changelog) {
    if (isHeaderFound) {
      yield chunk
      continue
    }
    
    pending += chunk
    
    // Only complete lines are searched, so a version header split between chunks is still found.
    const lastLineStart = pending.lastIndexOf('\n') + 1
    const headerIndex = pending.slice(0, lastLineStart).search(versionHeaderRegex)
    
    if (isIndex(headerIndex)) {
      isHeaderFound = true
      
      yield `${ pending.slice(0, headerIndex) }${ notes }\n${ pending.slice(headerIndex) }`
    } else {
      const writtenEnd = Math.min(lastLineStart, pending.trimEnd().length)
      
      if (writtenEnd > 0) {
        isContentWritten = true
        
        yield pending.slice(0, writtenEnd)
        
        pending = pending.slice(writtenEnd)
      }
    }
  }
  
  if (isHeaderFound) {
    return
  }
  
  // At the end of the file the last line is complete too.
  const headerIndex = pending.search(versionHeaderRegex)
  
  if (isIndex(headerIndex)) {
    yield `${ pending.slice(0, headerIndex) }${ notes }\n${ pending.slice(headerIndex) }`
  } else if (isContentWritten || pending.trim()) {
    // Changelog without releases yet, e.g. with an intro or an unreleased section only.
    yield `${ pending.trimEnd() }\n\n${ notes }`
  } else {
    yield `${ changelogHeader.trimEnd() }\n\n${ notes }`
  }
}

export const addReleaseNotes = async (changelogPath: string, notes: AsyncIterable<string>): Promise<string> => {
  const changes = await concatStringStream(notes)
  const changelog = existsSync(changelogPath)
    ? createReadStream(changelogPath, 'utf-8')
    : Readable.from([])
  // Temporary file is placed next to the changelog, because files cannot be renamed across file systems.
  const tmpChangelogPath = makeTempSiblingPath(changelogPath)
  
  try {
    await pipeline(
      changelog,
      chunks => insertReleaseNotes(chunks, changes),
      createWriteStream(tmpChangelogPath),
    )
    await rename(tmpChangelogPath, changelogPath)
  } finally {
    await rm(tmpChangelogPath, { force: true })
  }
  
  return changes
}

export const extractLastRelease = async (input: string | AsyncIterable<string>): Promise<LastRelease> => {
  // Lines split between chunks are joined back.
  const lines = isString(input)
    ? input.split('\n')
    : splitStream(input, '\n')
  let inLastChanges = false
  let notes = ''
  let previousTag = ''
  let nextTag = ''
  let version = ''
  
  for await (const line of lines) {
    const versionMatch = line.match(versionHeaderRegex)
    
    if (versionMatch) {
      if (inLastChanges) {
        break
      }
      
      [ , version ] = versionMatch
      inLastChanges = true
      
      const tagsMatch = line.match(tagsRegex)
      
      if (tagsMatch) {
        // Tags are extracted from the compare link and can be URL-encoded.
        previousTag = decodeTag(tagsMatch[1])
        nextTag = decodeTag(tagsMatch[2])
      }
      
      continue
    }
    
    if (inLastChanges) {
      notes += `${ line }\n`
    }
  }
  
  return {
    version,
    notes: notes.trim(),
    previousTag,
    nextTag,
  }
}
