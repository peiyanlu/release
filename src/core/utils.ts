import { runGit } from '@peiyanlu/cli-utils'
import { isUndefined } from '@peiyanlu/ts-utils'
import { existsSync, readFileSync } from 'node:fs'
import semver, { clean as cleanFn, prerelease as prereleaseFn, rcompare, type ReleaseType, SemVer, valid } from 'semver'


const nonPreReleaseTypes = [
  'patch',
  'minor',
  'major',
] as const

const getTypePriority = (type: ReleaseType | undefined) => nonPreReleaseTypes.indexOf(type as typeof nonPreReleaseTypes[number])

const getCurrentActiveType = (version: string) => {
  for (const type of nonPreReleaseTypes) {
    if (semver[type](version)) {
      return type
    }
  }
}

const getSnapshotTimestamp = (date = new Date()) => date
  .toISOString()
  .replace(/\D/g, '')
  .slice(0, 14)

export const setSnapshotIdentifier = (version: string, snapshot?: string): string => {
  if (!snapshot) {
    return version
  }
  
  const semverVersion = new SemVer(version)
  semverVersion.prerelease = [ snapshot, getSnapshotTimestamp() ]
  
  return semverVersion.format()
}

export const getPrereleaseIdentifier = (prerelease?: string, snapshot?: string): string | undefined => {
  if (snapshot) {
    return `${ snapshot }.${ getSnapshotTimestamp() }`
  }
  
  return prerelease
}

export const getPrereleaseIdentifierBase = (snapshot?: string): false | undefined => snapshot ? false : undefined

export const getReleaseType = (releaseType: ReleaseType, version: string, prerelease?: string): ReleaseType => {
  if (!isUndefined(prerelease)) {
    if (Array.isArray(prereleaseFn(version))) {
      const currentActiveType = getCurrentActiveType(version)
      
      if (currentActiveType === releaseType || getTypePriority(currentActiveType) > getTypePriority(releaseType)) {
        return 'prerelease'
      }
    }
    
    return `pre${ releaseType }` as ReleaseType
  }
  
  return releaseType
}

export const when = <T>(condition: unknown, ...value: T[]): T[] => condition ? [ ...value ] : []

export const unless = <T>(condition: unknown, ...value: T[]): T[] => condition ? [] : [ ...value ]


interface GitLogTagsParams {
  path?: string
  from?: string
  to?: string
  all?: boolean
}

export interface GetSemverTagsParams extends GitLogTagsParams {
  prefix?: string | RegExp
  skipUnstable?: boolean
  clean?: boolean
}


export async function firstFromStream<T>(stream: AsyncIterable<T>): Promise<T | undefined> {
  const iterator = stream[Symbol.asyncIterator]()
  const { value, done } = await iterator.next()
  
  return done ? undefined : value
}


export async function* getTags(params: GitLogTagsParams = {}): AsyncIterable<string> {
  const { path, from = '', to = 'HEAD', all } = params
  
  const stdout = await runGit(
    [
      'log',
      '--decorate=short',
      '--no-color',
      '--date-order',
      '--format=%D',
      ...when(all, '--all'),
      [ from, to ].filter(Boolean).join('..'),
      ...(path ? [ '--', path ] : []),
    ],
  )
  
  for (const record of stdout!.split(/\r?\n/)) {
    const tagRegex = /tag:\s*([^\s,]+)/gi
    for (const [ , tag ] of record.matchAll(tagRegex)) {
      yield tag.trim()
    }
  }
}

export async function* getSemverTags(params: GetSemverTagsParams = {}): AsyncIterable<string> {
  const { prefix, skipUnstable, clean, ...getTagsParams } = params
  const tagsStream = getTags(getTagsParams)
  
  const unstableTagRegex = /\d+\.\d+\.\d+-.+/
  const cleanTag = clean
    ? (tag: string, unprefixed?: string) => cleanFn(unprefixed || tag)
    : (tag: string) => tag
  let unprefixed: string
  let tag: string | null
  
  for await (tag of tagsStream) {
    if (skipUnstable && unstableTagRegex.test(tag)) {
      continue
    }
    
    if (prefix) {
      const isPrefixed = typeof prefix === 'string'
        ? tag.startsWith(prefix)
        : prefix.test(tag)
      
      if (isPrefixed) {
        unprefixed = tag.replace(prefix, '')
        
        if (valid(unprefixed)) {
          tag = cleanTag(tag, unprefixed)
          
          if (tag) {
            yield tag
          }
        }
      }
    } else if (valid(tag)) {
      tag = cleanTag(tag)
      
      if (tag) {
        yield tag
      }
    }
  }
}

export async function getLastSemverTag(params: GetSemverTagsParams = {}): Promise<string | undefined> {
  return firstFromStream(getSemverTags(params))
}

export async function getVersionFromTags(params: GetSemverTagsParams = {}): Promise<string | undefined> {
  const semverTagsStream = getSemverTags({ clean: true, ...params })
  const semverTags: string[] = []
  
  for await (const tag of semverTagsStream) {
    semverTags.push(tag)
  }
  
  if (!semverTags.length) {
    return undefined
  }
  
  return semverTags.sort(rcompare)[0]
}


export const readTextSync = (path: string): string => {
  if (!existsSync(path)) return ''
  return readFileSync(path).toString('utf8')
}


export interface HostedGitInfo {
  host: string
  prefix: string
  owner: string
  repo: string
}

export const parseHostedGitUrl = (url: string): HostedGitInfo => {
  const reg = /((?:github|gitlab|bitbucket|gitee|codeberg|sourceforge|git\.sr|\d+\.\d+\.\d+\.\d+:\d+)\.?(?:com|org|net|ht)?)[:\/](~)?([^/]+)\/(.+?)(?:[#/?](?:.+?)?)?(?:\.git)?$/
  
  const match = url.trim().match(reg) ?? []
  const [ domain = '', prefix = '', owner = '', repo = '' ] = [ ...match.slice(1) ]
  const host = domain ? `http${ url.includes('https://') ? 's' : '' }://${ domain }` : ''
  
  return { host, prefix, owner, repo }
}
