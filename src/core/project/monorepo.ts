import { isEmpty, type Simplify, throwError } from '@peiyanlu/ts-utils'
import { gt } from 'semver'
import type { ReleaseData } from '../hosting/index.js'
import type { ProjectManifest } from '../manifest/manifest.js'
import type {
  GetProjectsOptions,
  MonorepoMode,
  MonorepoProjectBumpOptions,
  MonorepoProjectOptions,
} from './monorepo.types.js'
import { Project } from './project.js'
import type {
  ProjectMaintenanceBranch,
  ProjectMaintenanceBranchesOptions,
  ProjectOptions,
  ProjectReleaseOptions,
  ProjectRevertOptions,
  ProjectTagsOptions,
} from './project.types.js'


export abstract class MonorepoProject extends Project {
  readonly mode: MonorepoMode
  declare options: MonorepoProjectOptions & ProjectOptions
  
  override async getCommitMessage(): Promise<string> {
    if (this.isFixedMode) {
      return super.getCommitMessage()
    }
    
    return this.getIndependentCommitMessage()
  }
  
  override async getTagPrefix(scope: string): Promise<string> {
    if (this.options.tagPrefix) {
      return this.options.tagPrefix(scope ?? '')
    }
    
    if (this.isFixedMode) {
      return super.getTagPrefix()
    }
    
    return `${ scope }@`
  }
  
  override async getTags(options: ProjectTagsOptions = {}): Promise<string[]> {
    if (this.isFixedMode) {
      return super.getTags(options)
    }
    
    return this.getIndependentTags(options)
  }
  
  override async getReleaseData(options: ProjectReleaseOptions = {}): Promise<ReleaseData[]> {
    if (this.isFixedMode) {
      return super.getReleaseData(options)
    }
    
    return this.getIndependentReleaseData(options)
  }
  
  override async isFirstRelease(options: ProjectReleaseOptions = {}): Promise<boolean> {
    if (this.isFixedMode) {
      return super.isFirstRelease(options)
    }
    
    return this.isIndependentFirstRelease()
  }
  
  override async getDefaultPublishTag(options: ProjectReleaseOptions = {}): Promise<Map<string, string>> {
    if (this.isFixedMode) {
      return super.getDefaultPublishTag(options)
    }
    
    return this.getIndependentDefaultPublishTag(options)
  }
  
  override async getMaintenanceBranches(options: ProjectMaintenanceBranchesOptions = {}): Promise<ProjectMaintenanceBranch[]> {
    if (this.isFixedMode) {
      return super.getMaintenanceBranches(options)
    }
    
    return this.getIndependentMaintenanceBranches(options)
  }
  
  override getNextVersion(options: MonorepoProjectBumpOptions = {}): Promise<string | undefined> {
    if (this.isFixedMode && options.version) {
      return super.getNextVersion(options)
    }
    
    throwError('Monorepo project "independent" mode does not support getNextVersion')
  }
  
  override async bump(options: MonorepoProjectBumpOptions = {}): Promise<boolean> {
    if (this.isFixedMode) {
      return this.fixedBump(options)
    }
    
    return this.independentBump(options)
  }
  
  override async revert(options: ProjectRevertOptions = {}): Promise<boolean> {
    const { manifest, versionUpdates } = this
    const { dryRun, logger } = options
    
    const files = new Set<string>()
    const rootUpdate = versionUpdates.find(({ files }) => files.includes(manifest.filepath))
    let hasRevert = false
    
    if (rootUpdate) {
      logger?.verbose(`Reverting ${ rootUpdate.name }: ${ rootUpdate.to } -> ${ rootUpdate.from }`)
      rootUpdate.files.forEach(file => files.add(file))
      
      await manifest.writeVersion(rootUpdate.from, dryRun)
      hasRevert = true
    }
    
    for await (const project of this.getProjects()) {
      hasRevert = await project.revert(options, files) || hasRevert
    }
    
    this.changedFiles = this.changedFiles.filter(file => !files.has(file))
    this.versionUpdates.length = 0
    
    return hasRevert
  }
  
  private projectsMutex?: Promise<Project[]>
  
  protected constructor(options: Simplify<MonorepoProjectOptions>) {
    const { mode, compose } = options
    
    super({
      ...options,
      compose: compose
        ? (manifest, isRoot = true) => compose(manifest, isRoot)
        : manifest => manifest,
    })
    
    this.mode = mode
  }
  
  get isFixedMode(): boolean {
    return this.mode === 'fixed'
  }
  
  get isIndependentMode(): boolean {
    return this.mode === 'independent'
  }
  
  async* getProjects(): AsyncGenerator<Project> {
    if (!this.projectsMutex) {
      const { compose, getProjects } = this.options
      const options = {
        compose: (manifest: ProjectManifest) => compose!(manifest, false),
        manifest: this.manifest,
      } satisfies GetProjectsOptions
      
      // 在自包含的生成器中构建并缓存列表。从专用任务中解析缓存（而不是在下面的循环之后解析）可以防止在消费者提前停止迭代时出现挂起
      this.projectsMutex = (async () => {
        const projects: Project[] = []
        
        for await (const project of getProjects(options)) {
          if (!await project.manifest.isPrivate()) {
            projects.push(project)
          }
        }
        
        return projects
      })()
    }
    
    yield* await this.projectsMutex
  }
  
  async getScope(name: string): Promise<string> {
    if (this.options.scope) {
      return this.options.scope(name, await this.manifest.getName())
    }
    
    return name.replace(/@[^/]+\//, '')
  }
  
  async getMaxVersion(): Promise<{ version: string; packages: string[] }> {
    const { manifest } = this
    
    let max = await manifest.getVersion()
    const packages = []
    
    for await (const project of this.getProjects()) {
      const name = await project.manifest.getName()
      const version = await project.manifest.getVersion()
      
      if (gt(version, max)) {
        max = version
        packages.length = 0
      }
      
      if (version === max) {
        packages.push(name)
      }
    }
    
    return { version: max, packages }
  }
  
  private getIndependentCommitMessage(): string {
    const { versionUpdates } = this
    
    if (isEmpty(versionUpdates)) {
      throwError('Nothing to commit')
    }
    
    return `chore(release): monorepo release\n\n${
      versionUpdates
        .map(({ name, to }) => `- ${ name }@${ to }`)
        .join('\n')
    }`
  }
  
  private async getIndependentTags(options: ProjectTagsOptions): Promise<string[]> {
    const tags: string[] = []
    
    for await (const project of this.getProjects()) {
      if (project.hasBump) {
        const name = await project.manifest.getName()
        const scope = await this.getScope(name)
        const tagPrefix = await this.getTagPrefix(scope)
        
        tags.push(...await project.getTags({ ...options, tagPrefix }))
      }
    }
    
    return tags
  }
  
  private async getIndependentReleaseData(options: ProjectReleaseOptions): Promise<ReleaseData[]> {
    const data: ReleaseData[] = []
    
    for await (const project of this.getProjects()) {
      if (project.hasBump) {
        const name = await project.manifest.getName()
        const scope = await this.getScope(name)
        const tagPrefix = await this.getTagPrefix(scope)
        
        const version = await project.manifest.getVersion()
        const releaseData = await project.getReleaseData({ ...options, tagPrefix })
        data.push(...releaseData.map(data => ({
          ...data,
          title: this.toTag(tagPrefix, version),
        })))
      }
    }
    
    return data
  }
  
  private async getIndependentDefaultPublishTag(options: ProjectReleaseOptions): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    
    for await (const project of this.getProjects()) {
      const name = await project.manifest.getName()
      const scope = await this.getScope(name)
      const tagPrefix = await this.getTagPrefix(scope)
      
      const tag = await project.getDefaultPublishTag({ ...options, tagPrefix })
      
      map.set(name, tag.get(name)!)
    }
    
    return map
  }
  
  private async getIndependentMaintenanceBranches(options: ProjectMaintenanceBranchesOptions): Promise<ProjectMaintenanceBranch[]> {
    const branches: ProjectMaintenanceBranch[] = []
    
    for await (const project of this.getProjects()) {
      const name = await project.manifest.getName()
      const scope = await this.getScope(name)
      const tagPrefix = await this.getTagPrefix(scope)
      
      branches.push(...await project.getMaintenanceBranches({
        ...options,
        tagPrefix,
      }))
    }
    
    return branches
  }
  
  private async getBumpOptions(
    project: Project,
    options: Simplify<MonorepoProjectBumpOptions>,
    baseVersion?: string,
    firstRelease?: boolean,
  ) {
    const { extraScopes = [], byProject, force, ...bumpOptions } = options
    
    const name = await project.manifest.getName()
    const scope = await this.getScope(name)
    const tagPrefix = await this.getTagPrefix(scope)
    
    return {
      firstRelease,
      ...bumpOptions,
      ...byProject?.[name],
      scope: [ scope, ...extraScopes ],
      tagPrefix,
      baseVersion,
    }
  }
  
  private async independentBump(options: Simplify<MonorepoProjectBumpOptions> = {}): Promise<boolean> {
    let hasBump = false
    
    for await (const project of this.getProjects()) {
      const projectBumpOptions = await this.getBumpOptions(project, options)
      
      hasBump = await project.bump(projectBumpOptions) || hasBump
      
      this.changedFiles.push(...project.changedFiles)
      this.versionUpdates.push(...project.versionUpdates)
    }
    
    return hasBump
  }
  
  private async fixedBump(options: Simplify<MonorepoProjectBumpOptions> = {}): Promise<boolean> {
    const { force } = options
    const { manifest } = this
    
    const rootVersion = await manifest.getVersion()
    const name = await manifest.getName()
    const tagPrefix = await this.getTagPrefix(name)
    
    const firstRelease = await this.isFirstRelease({ tagPrefix })
    
    let hasBump = false
    let fixedVersion: string | undefined
    
    const updatedProjects: { project: Project; options: MonorepoProjectBumpOptions; }[] = []
    for await (const project of this.getProjects()) {
      const projectBumpOptions = await this.getBumpOptions(
        project,
        options,
        rootVersion,
        firstRelease,
      )
      
      const nextVersion = await project.getNextVersion(projectBumpOptions)
      
      if (nextVersion || force) {
        updatedProjects.push({
          project,
          options: projectBumpOptions,
        })
        
        if (nextVersion && (!fixedVersion || gt(nextVersion, fixedVersion))) {
          fixedVersion = nextVersion
        }
      }
    }
    
    if (fixedVersion) {
      hasBump = await super.bump({
        ...options,
        forcePrivate: true,
        version: fixedVersion,
        tagPrefix,
      })
      
      for (const { project, options } of updatedProjects) {
        hasBump = await project.bump({ ...options, version: fixedVersion }) || hasBump
        
        this.changedFiles.push(...project.changedFiles)
        this.versionUpdates.push(...project.versionUpdates)
      }
    }
    
    return hasBump
  }
  
  private async isIndependentFirstRelease(options: ProjectReleaseOptions = {}) {
    let allFirst = true
    
    for await (const project of this.getProjects()) {
      const name = await project.manifest.getName()
      const scope = await this.getScope(name)
      const tagPrefix = await this.getTagPrefix(scope)
      
      allFirst &&= await project.isFirstRelease({ ...options, tagPrefix })
    }
    
    return allFirst
  }
}
