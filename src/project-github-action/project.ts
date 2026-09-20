import { gitConfigGet, parseGitHubRepo, runGit } from '@peiyanlu/cli-utils'
import { assert, isNotEmpty, tryCall } from '@peiyanlu/ts-utils'
import {
  PackageJsonProject,
  type PackageJsonProjectOptions,
  type ProjectBumpOptions,
  type ProjectOptions,
  type ProjectPublishCheckOptions,
  type ProjectReleaseOptions,
} from '../core/index.js'
import { getSemverTags } from '../core/utils.js'
import { publish, type PublishOptions } from './publish.js'


export interface NodeGithubActionProjectOptions extends PackageJsonProjectOptions {
  /**
   * 版本标签的前缀。
   * @default 'v'
   */
  tagPrefix?: string
}

export type NodeGithubActionProjectBumpOptions = ProjectBumpOptions

export type NodeGithubActionProjectPublishOptions = PublishOptions


/** Node.js GitHub Actions 项目，将版本引用发布到 Git 分支和标签 */
export class NodeGithubActionProject extends PackageJsonProject {
  declare options: NodeGithubActionProjectOptions & ProjectOptions
  
  /**
   * 获取项目最近一次发布的标签。
   * GitHub Action 发布标签指向发布分支中的打包提交，无法从源分支到达。因此需要遍历所有引用，并通过标签的父提交判断它是否属于当前分支。
   */
  override async getLastReleaseTag(options: ProjectReleaseOptions = {}): Promise<string | undefined> {
    const { tagPrefix: override } = options
    
    const tagPrefix = await this.getTagPrefix(override)
    const tags = getSemverTags({
      prefix: tagPrefix,
      all: true,
    })
    
    for await (const tag of tags) {
      // 打包发布提交是在源分支的发布提交上修改而来，因此当前分支应能到达标签本身或其父提交。
      if (await this.isReachableFromHead(tag) || await this.isReachableFromHead(`${ tag }^`)) {
        return tag
      }
    }
  }
  
  override async publish(options: NodeGithubActionProjectPublishOptions = {}): Promise<void> {
    const tagsMap = await this.getDefaultPublishTag()
    const name = await this.manifest.getName()
    const tag = tagsMap.get(name)
    
    await publish(this, { tag, ...options })
  }
  
  override async publishCheck(options: ProjectPublishCheckOptions): Promise<void> {
    const { logger } = options
    
    logger?.verbose('Checking GitHub repository configuration...')
    
    const remoteUrl = await gitConfigGet('remote.origin.url')
    const useGithub = isNotEmpty(parseGitHubRepo(remoteUrl!))
    assert(useGithub, 'Git remote "origin" is not a GitHub repository')
  }
  
  constructor(options: NodeGithubActionProjectOptions = {}) {
    super(options)
  }
  
  private async isReachableFromHead(ref: string) {
    return tryCall(() => runGit([ 'merge-base', '--is-ancestor', ref, 'HEAD' ]), false)
  }
}
