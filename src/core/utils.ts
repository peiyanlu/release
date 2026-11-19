import { isPrerelease } from '@peiyanlu/cli-utils'
import { runGit } from '@peiyanlu/command-utils'
import { firstFromIterable, isPositive, isUndefined, isZero, when } from '@peiyanlu/ts-utils'
import semver, {
  clean as cleanFn,
  diff,
  major,
  minor,
  prerelease as prereleaseFn,
  rcompare,
  type ReleaseType,
  SemVer,
  valid,
} from 'semver'


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
  return firstFromIterable(getSemverTags(params))
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


export interface HostedGitInfo {
  origin: string
  host: string
  hostname: string
  port: string
  prefix: string
  owner: string
  repo: string
}

export const parseHostedGitUrl = (url: string): HostedGitInfo => {
  const reg = /(((?:github|gitlab|bitbucket|gitee|codeberg|sourceforge|git\.sr|\d+\.\d+\.\d+\.\d+)\.?(?:com|org|net|ht)?)(?::(\d+))?)[:\/](~)?([^/]+)\/(.+?)(?:[#/?](?:.+?)?)?(?:\.git)?$/
  
  const match = url.trim().match(reg) ?? []
  
  const [ host = '', hostname = '', port = '', prefix = '', owner = '', repo = '' ] = [ ...match.slice(1) ]
  const origin = hostname ? `http${ url.includes('https://') ? 's' : '' }://${ host }` : ''
  
  return { origin, host, hostname, port, prefix, owner, repo }
}

/**
 * 判断从当前版本升级到下一个版本，是否会破坏依赖方的兼容性。
 *
 * 判定规则：
 * - 下一个版本超出当前版本对应的 caret 兼容范围时，判定为破坏性升级。
 * - 对于 0.x 版本，0.y.z 的次版本升级，以及 0.0.z 的补丁版本升级，均判定为破坏性升级。
 * - 进入新的主版本预发布版，或从该主版本的预发布版升级到正式版，均判定为破坏性升级。
 * - 同一预发布版本序列内的升级不判定为破坏性升级。
 *
 * @param currentVersion 当前版本
 * @param nextVersion 下一个版本
 * @returns 如果升级会破坏依赖方的兼容性，则返回 true；否则返回 false
 */
export const isBreakingBump = (currentVersion: string, nextVersion: string): boolean => {
  switch (diff(currentVersion, nextVersion)) {
    case 'major':
    case 'premajor':
      return true
    
    // 在 0.x 阶段，次版本升级可能不兼容
    case 'minor':
    case 'preminor':
      return isZero(major(currentVersion))
    
    // 在 0.0.x 阶段，补丁升级也可能不兼容
    case 'patch':
    case 'prepatch':
      return isZero(major(currentVersion)) && isZero(minor(currentVersion))
    
    case 'release':
      return (
        isPrerelease(currentVersion) &&
        isPositive(major(currentVersion)) &&
        isZero(minor(currentVersion)) &&
        isZero(major(currentVersion))
      )
    
    case 'prerelease':
    case null:
      return false
  }
}
