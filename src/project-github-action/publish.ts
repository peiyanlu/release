import {
  execAsync,
  gitAdd,
  gitBranch,
  gitBranchCurrent,
  gitCheckout,
  gitCheckoutBranchForce,
  gitCommitAmendNoEdit,
  gitDiff,
  gitFetch,
  gitPush,
  gitRevParse,
  gitTag,
} from '@peiyanlu/cli-utils'
import { equals, isFunction, throwError } from '@peiyanlu/ts-utils'
import { major, valid } from 'semver'
import { DEFAULT_PUBLISH_TAG, type ProjectPublishOptions } from '../core/index.js'
import { NodeGithubActionProject } from './project.js'


export interface PublishOptions extends ProjectPublishOptions {
  /**
   * 发布引用前要运行的构建或安装命令。
   */
  build?: string | string[]
  /**
   * 构建后要暂存的文件。默认使用 package.json 中的 `files`。
   */
  files?: string[]
  /**
   * 运行构建命令前要设置的环境变量。
   * @default process.env
   */
  env?: Record<string, string | undefined>
}


const runBuildCommands = async (
  commands: string[],
  options: Pick<PublishOptions, 'dryRun' | 'env' | 'logger'>,
  cwd: string,
) => {
  const { dryRun, env = process.env, logger } = options
  
  for (const command of commands) {
    logger?.info(`Running build command: ${ command }`)
    
    if (!dryRun) {
      await execAsync(command, {
        cwd,
        env,
        error: 'log',
      })
    }
  }
}


export const publish = async (project: NodeGithubActionProject, options: PublishOptions = {}): Promise<void> => {
  const { manifest, manifest: { projectDir } } = project
  const { dryRun, logger, tag } = options
  
  const publishTag = isFunction(tag)
    ? tag(
      await manifest.getVersion(),
      await manifest.getPrereleaseVersion(),
    )
    : tag ?? DEFAULT_PUBLISH_TAG
  
  const pkg = await manifest.readManifest()
  const version = await manifest.getVersion()
  const validVersion = valid(version)
  
  if (!validVersion) {
    throwError(`Invalid GitHub Action version: ${ version }`)
  }
  
  const { build = [], files = pkg.files = [] } = options
  
  const tagPrefix = await project.getTagPrefix()
  
  const withTag = (version: string, tag: string) => {
    return equals(tag, DEFAULT_PUBLISH_TAG) ? version : `${ version }-${ tag }`
  }
  
  const majorBranch = withTag(`${ tagPrefix }${ major(validVersion) }`, publishTag)
  const versionTag = project.toTag(tagPrefix, validVersion)
  const buildBranch = publishTag
  
  const buildCommands = Array.isArray(build) ? build : [ build ]
  
  const originalBranch = await gitBranchCurrent()
  const releaseCommit = await gitRevParse([ '--verify', 'HEAD' ])
  
  logger?.info(`Publishing GitHub Action ${ versionTag }...`)
  logger?.verbose(`Build branch: ${ buildBranch }`)
  logger?.verbose(`Major branch: ${ majorBranch }`)
  
  let shouldRestoreBranch = false
  
  try {
    if (!dryRun) {
      const isShallowRepository = await gitRevParse([ '--is-shallow-repository' ]) === 'true'
      
      if (isShallowRepository) {
        logger?.info('Fetching git history...')
        
        await gitFetch([ '--deepen=1', '--', 'origin', originalBranch ])
      }
      
      await gitCheckoutBranchForce(buildBranch, releaseCommit)
      
      shouldRestoreBranch = originalBranch !== buildBranch
    }
    
    await runBuildCommands(buildCommands, options, projectDir)
    
    if (!dryRun && files.length) {
      logger?.info('Staging GitHub Action files...')
      
      await gitAdd([ '--force', '--', ...files ])
      
      const stagedFiles = await gitDiff([ '--cached', '--name-only' ])
      
      if (stagedFiles) {
        await gitCommitAmendNoEdit([ '--no-verify' ])
      }
    }
    
    if (!dryRun) {
      logger?.info('Creating GitHub Action release refs...')
      
      await gitBranch([ '-f', '--', majorBranch, 'HEAD' ])
      await gitTag([ '-f', '--', versionTag, 'HEAD' ])
      
      logger?.info('Pushing GitHub Action release refs...')
      
      await gitPush([ '--force', '--no-verify', 'origin', '--', buildBranch ])
      await gitPush([ '--force', '--no-verify', 'origin', '--', majorBranch ])
      await gitPush([ '--force', '--no-verify', 'origin', '--', versionTag ])
    }
  } finally {
    if (shouldRestoreBranch) {
      await gitCheckout([ originalBranch ])
    }
  }
}
