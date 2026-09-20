import { execAsync } from '@peiyanlu/cli-utils'
import { copyDir, createMatcher, createTempDir } from '@peiyanlu/node-utils'
import { isEmpty, isFunction } from '@peiyanlu/ts-utils'
import { resolve } from 'node:path'
import { Project, type ProjectPublishOptions } from '../core/index.js'
import { unless, when } from '../core/utils.js'
import { cleanPackageJSON, cleanReadme, IGNORE_FILES } from './cleanup.js'


export interface CleanupOptions {
  /** 是否清理项目内容后再发布 */
  cleanPublish?: boolean
  /** package.json 需要忽略的字段，支持 `a.b.c` */
  ignoreFields?: string[]
  /** package.json 需要保留的脚本，默认：`preinstall | install | postinstall` */
  keepScripts?: string[]
  /** 是否精简 README.md，仅保留主要内容 */
  cleanReadme?: boolean
}

export interface PublishOptions extends ProjectPublishOptions, CleanupOptions {
  access?: string
  registry?: string
  otp?: string
  env?: Record<string, string | undefined>
  /** 是否在发布前执行 git 检查 */
  gitChecks?: boolean
}


export const publish = async (project: Project, options: PublishOptions = {}): Promise<void> => {
  const { manifest, manifest: { projectDir } } = project
  const { access, tag, otp, env = process.env, dryRun, logger, gitChecks, cleanPublish } = options
  
  const publishTag = isFunction(tag)
    ? tag(
      await manifest.getVersion(),
      await manifest.getPrereleaseVersion(),
    )
    : tag
  
  const args = [
    'publish',
    ...when(access, '--access', access!),
    ...when(publishTag, '--tag', publishTag!),
    ...when(dryRun, '--dry-run'),
    ...when(otp, '--otp', otp!),
    ...unless(gitChecks, '--no-git-checks'),
  ]
  
  if (cleanPublish) {
    const { ignoreFields, keepScripts, cleanReadme: shouldCleanReadme } = options
    
    const parent = resolve(projectDir)
    const temp = await createTempDir(parent)
    
    await copyDir(parent, temp.path, {
      ignore: [
        (name) => {
          const patterns = [ temp.name, ...IGNORE_FILES ]
          const matchers = patterns.map(pattern => createMatcher(pattern))
          return matchers.some(matcher => matcher(name))
        },
      ],
    })
    
    await cleanPackageJSON(temp.path, { ignoreFields, keepScripts })
    
    if (shouldCleanReadme) {
      const info = await project.getHostedGitInfo()
      const empty = Object.values(info).every(isEmpty)
      if (!empty) {
        const { host, prefix, owner, repo } = info
        await cleanReadme(temp.path, `${ host }/${ prefix }${ owner }/${ repo }#readme`)
      }
    }
    
    logger?.verbose(`Publishing "${ await manifest.getName() }" with command: pnpm ${ args.join(' ') }`)
    
    await execAsync(
      'pnpm',
      args,
      {
        cwd: temp.path,
        env,
        error: 'log',
      },
    )
    
    await temp.remove()
  } else {
    logger?.verbose(`Publishing "${ await manifest.getName() }" with command: pnpm ${ args.join(' ') }`)
    
    await execAsync(
      'pnpm',
      args,
      {
        cwd: projectDir,
        env,
        error: 'log',
      },
    )
  }
}
