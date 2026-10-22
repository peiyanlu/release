import { gitConfigGet, gitRevParse } from '@peiyanlu/cli-utils'
import { equals, isEmpty, isFunction, isString, isUndefined, throwError } from '@peiyanlu/ts-utils'
import { join } from 'path'
import { gte, inc, major, type ReleaseType, valid } from 'semver'
import { Changelog, extractLastRelease } from '../changelog/index.js'
import type { ReleaseData } from '../hosting/index.js'
import type { ProjectManifest } from '../manifest/manifest.js'
import {
  getLastSemverTag,
  getPrereleaseIdentifier,
  getPrereleaseIdentifierBase,
  getReleaseType,
  getVersionFromTags,
  type HostedGitInfo,
  parseHostedGitUrl,
  readTextSync,
  setSnapshotIdentifier,
} from '../utils.js'
import type { MonorepoProject } from './monorepo.js'
import type {
  ProjectBumpOptions,
  ProjectMaintenanceBranch,
  ProjectMaintenanceBranchesOptions,
  ProjectOptions,
  ProjectPublishCheckOptions,
  ProjectPublishOptions,
  ProjectReleaseOptions,
  ProjectRevertOptions,
  ProjectTagsOptions,
  ProjectVersionUpdate,
} from './project.types.js'


export const DEFAULT_TAG_PREFIX = 'v'
export const DEFAULT_CHANGELOG_FILE = 'CHANGELOG.md'
export const DEFAULT_PUBLISH_TAG = 'latest'
export const DEFAULT_PRE_PUBLISH_TAG = 'next'


export abstract class Project {
  manifest: ProjectManifest
  changedFiles: string[] = []
  versionUpdates: ProjectVersionUpdate[] = []
  
  protected constructor(public options: ProjectOptions) {
    this.options.changelogFile ??= DEFAULT_CHANGELOG_FILE
    
    const { compose, manifest } = options
    this.manifest = compose?.(manifest) ?? manifest
  }
  
  get hasBump(): boolean {
    return this.versionUpdates.length > 0
  }
  
  async getHostedGitInfo(): Promise<HostedGitInfo> {
    const remote = await gitConfigGet('remote.origin.url')
    return parseHostedGitUrl(remote ?? '')
  }
  
  isMonorepoMode(): this is MonorepoProject {
    return 'mode' in this
  }
  
  async getCommitMessage(): Promise<string> {
    const { versionUpdates, versionUpdates: [ { to } ] } = this
    
    if (isEmpty(versionUpdates)) {
      throwError('Nothing to commit')
    }
    
    return `chore(release): ${ to }`
  }
  
  toTag(tagPrefix: string, version: string): string {
    return `${ tagPrefix }${ version }`
  }
  
  toBranch(branchPrefix: string, version: string): string {
    return `${ branchPrefix }${ major(version) }`
  }
  
  async getTagPrefix(override?: string): Promise<string> {
    if (!isUndefined(override)) return override
    
    const { options: { tagPrefix = DEFAULT_TAG_PREFIX } } = this
    
    return isFunction(tagPrefix) ? tagPrefix('') : tagPrefix
  }
  
  async getTags(options: ProjectTagsOptions = {}): Promise<string[]> {
    const { manifest } = this
    const { tagPrefix: override, verify = true } = options
    
    const tagPrefix = await this.getTagPrefix(override)
    const version = await manifest.getVersion()
    const tag = this.toTag(tagPrefix, version)
    
    if (verify) {
      const isTagExists = await gitRevParse([ '--verify', tag ])
      if (isTagExists) {
        console.log('isTagExists:', isTagExists)
        return []
      }
    }
    
    return [ tag ]
  }
  
  async getReleaseData(options: ProjectReleaseOptions = {}): Promise<ReleaseData[]> {
    const { manifest, versionUpdates, versionUpdates: [ { notes } ], options: { changelogFile } } = this
    const { projectDir } = manifest
    const { tagPrefix: override } = options
    
    const tagPrefix = await this.getTagPrefix(override)
    const version = await manifest.getVersion()
    const isPrerelease = Boolean(await manifest.getPrereleaseVersion())
    
    const lastRelease = await extractLastRelease(
      isEmpty(versionUpdates)
        ? readTextSync(join(projectDir, changelogFile!))
        : notes,
    )
    
    const empty = Object.values(lastRelease).every(isEmpty)
    if (empty || lastRelease.version && lastRelease.version !== version) {
      return []
    }
    
    if (!lastRelease.nextTag) {
      const tags = await this.getTags({ tagPrefix, verify: false })
      
      if (tags.length) {
        [ lastRelease.nextTag ] = tags
      }
    }
    
    return [
      {
        ...lastRelease,
        title: this.toTag(tagPrefix, version),
        version,
        isPrerelease,
        isLatest: await this.isLatestRelease(options),
      },
    ]
  }
  
  async isFirstRelease(options: ProjectReleaseOptions = {}): Promise<boolean> {
    return !await this.getLastReleaseTag(options)
  }
  
  async getLastReleaseTag(options: ProjectReleaseOptions = {}): Promise<string | undefined> {
    const { manifest: { projectDir } } = this
    const { tagPrefix: override } = options
    
    const tagPrefix = await this.getTagPrefix(override)
    
    return getLastSemverTag({
      path: projectDir,
      prefix: tagPrefix,
    })
  }
  
  async isLatestRelease(options: ProjectReleaseOptions = {}): Promise<boolean> {
    const { manifest } = this
    const { tagPrefix: override } = options
    
    const version = await manifest.getVersion()
    
    const currentVersion = valid(version)
    if (!currentVersion) return true
    
    const tagPrefix = await this.getTagPrefix(override)
    const latestVersion = await getVersionFromTags({
      prefix: tagPrefix,
      skipUnstable: true,
      all: true,
    })
    
    return !latestVersion || gte(currentVersion, latestVersion)
  }
  
  async getDefaultPublishTag(options: ProjectReleaseOptions = {}): Promise<Map<string, string>> {
    const { manifest } = this
    const name = await manifest.getName()
    const version = await manifest.getVersion()
    
    const map = new Map<string, string>()
    map.set(name, DEFAULT_PUBLISH_TAG)
    
    const prerelease = await manifest.getPrereleaseVersion()
    if (prerelease) {
      const [ identifier ] = prerelease
      const tag = isString(identifier) ? identifier : DEFAULT_PRE_PUBLISH_TAG
      
      map.set(name, tag)
      return map
    }
    
    if (!await this.isLatestRelease(options)) {
      const tag = `release.${ major(version) }.x`
      
      map.set(name, tag)
      return map
    }
    
    return map
  }
  
  /** 在主要版本发布后创建维护分支引用 */
  async getMaintenanceBranches(options: ProjectMaintenanceBranchesOptions = {}): Promise<ProjectMaintenanceBranch[]> {
    const { manifest } = this
    const { tagPrefix: override, branchPrefix } = options
    
    const tagPrefix = await this.getTagPrefix(override)
    const version = await manifest.getVersion()
    const currentVersion = valid(version)
    if (!currentVersion) return []
    
    const [ releaseData ] = await this.getReleaseData(options)
    const previousTag = releaseData?.previousTag || await this.getLastReleaseTag({ tagPrefix })
    if (previousTag) {
      const previousVersion = valid(
        previousTag.startsWith(tagPrefix)
          ? previousTag.slice(tagPrefix.length)
          : previousTag,
      )
      
      if (previousVersion && major(currentVersion) > major(previousVersion)) {
        return [
          {
            from: previousTag,
            to: this.toBranch(branchPrefix ?? tagPrefix, previousVersion),
          },
        ]
      }
    }
    
    return []
  }
  
  changelog(options: ProjectBumpOptions & { scope?: string[] } = {}): Changelog {
    const { manifest: { projectDir }, options: { changelogFile } } = this
    const { tagPrefix, releaseCount, preamble, transformTypes, scope } = options
    
    return new Changelog({
      pkgDir: projectDir,
      tagPrefix,
      filename: changelogFile!,
      releaseCount,
      preamble,
      transformTypes,
      scope,
    })
  }
  
  async getNextVersion(options: ProjectBumpOptions = {}): Promise<string | undefined> {
    const { manifest } = this
    const { forcePrivate, logger } = options
    
    if (!forcePrivate && await manifest.isPrivate()) {
      return
    }
    
    const { version: forcedVersion, baseVersion, as, prerelease, snapshot, firstRelease, tagPrefix: override } = options
    let isFirstRelease = firstRelease
    
    const tagPrefix = await this.getTagPrefix(override)
    const name = await manifest.getName()
    
    if (forcedVersion && valid(forcedVersion)) {
      logger?.verbose(`Using specified version "${ forcedVersion }" for "${ name }".`)
      return setSnapshotIdentifier(forcedVersion, snapshot)
    }
    
    if (isUndefined(firstRelease)) {
      isFirstRelease = await this.isFirstRelease({ tagPrefix })
    }
    
    const version = baseVersion ?? await manifest.getVersion()
    
    if (isFirstRelease) {
      logger?.verbose(`First release detected for "${ name }".`)
      return setSnapshotIdentifier(version, snapshot)
    }
    
    const forcePrerelease = equals('prerelease', as)
    let releaseType = as
    
    if (!as || forcePrerelease) {
      const inferred = await this.inferReleaseType({ ...options, tagPrefix })
      
      if (inferred) {
        releaseType = inferred
      }
    }
    
    if (!releaseType) {
      if (!snapshot && !forcePrerelease) {
        logger?.verbose(`No release type detected for "${ name }".`)
        
        return
      }
      
      logger?.verbose(`No release type detected for "${ name }", defaulting to "patch" for snapshot or forced prerelease mode.`)
      
      // 快照版本和强制预发布版本应始终发布，即使没有新的提交
      releaseType = 'patch'
    }
    
    const identifier = getPrereleaseIdentifier(
      forcePrerelease
        ? prerelease ?? 'beta'
        : prerelease,
      snapshot,
    )
    
    return inc(
      version,
      getReleaseType(releaseType, version, identifier),
      false,
      identifier,
      getPrereleaseIdentifierBase(snapshot),
    )!
  }
  
  async inferReleaseType(options: ProjectBumpOptions = {}): Promise<ReleaseType | undefined> {
    const { logger, tagPrefix: override } = options
    const { manifest } = this
    
    const tagPrefix = await this.getTagPrefix(override)
    const { releaseType, reason } = await this.changelog({ ...options, tagPrefix }).inferReleaseType()
    
    if (reason) {
      logger?.verbose(`${ reason } for "${ await manifest.getName() }"`)
    }
    
    return releaseType
  }
  
  async bump(options: ProjectBumpOptions = {}): Promise<boolean> {
    const { logger, firstRelease } = options
    const { manifest } = this
    
    const name = await manifest.getName()
    const version = await manifest.getVersion()
    
    const nextVersion = await this.getNextVersion(options)
    if (!nextVersion || (version === nextVersion && !firstRelease)) {
      logger?.verbose(`No version changes for "${ name }". Skipping.`)
      return false
    }
    
    const { tagPrefix: override, skipChangelog, dryRun } = options
    
    const versionUpdate = {
      ...await manifest.writeVersion(nextVersion, dryRun),
      notes: '',
    }
    
    this.versionUpdates.push(versionUpdate)
    this.changedFiles.push(...versionUpdate.files)
    
    if (version === nextVersion) {
      logger?.verbose(`${ name }: ${ nextVersion }`)
    } else {
      logger?.verbose(`${ name }: ${ version } -> ${ nextVersion }`)
    }
    
    if (!skipChangelog) {
      const tagPrefix = await this.getTagPrefix(override)
      const lastReleaseTag = await this.getLastReleaseTag({ tagPrefix })
      
      const log = this.changelog({ ...options, tagPrefix })
      log.setOptions({ version: nextVersion, previousTag: lastReleaseTag })
      
      versionUpdate.notes = dryRun ? await log.read() : await log.write()
      
      logger?.verbose(`Release notes:\n\n${ versionUpdate.notes ?? '...' }`)
      
      this.changedFiles.push(log.infile)
    }
    
    return true
  }
  
  async revert(options: ProjectRevertOptions = {}, filesSet: Set<string> = new Set()): Promise<boolean> {
    const { manifest, versionUpdates } = this
    const { dryRun, logger } = options
    
    if (isEmpty(versionUpdates)) {
      return false
    }
    
    for (const update of versionUpdates) {
      logger?.verbose(`Reverting ${ update.name }: ${ update.to } -> ${ update.from }`)
      update.files.forEach(file => filesSet.add(file))
      
      await manifest.writeVersion(update.from, dryRun)
    }
    
    this.changedFiles = this.changedFiles.filter(file => !filesSet.has(file))
    this.versionUpdates.length = 0
    
    return true
  }
  
  abstract publish(options?: ProjectPublishOptions): Promise<void>
  
  abstract publishCheck(options?: ProjectPublishCheckOptions): Promise<void>
}
