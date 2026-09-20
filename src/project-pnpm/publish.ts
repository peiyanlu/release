import { execAsync } from '@peiyanlu/cli-utils'
import { Project, type ProjectPublishOptions } from '../core/index.js'


export interface PublishOptions extends ProjectPublishOptions {
  access?: string
  registry?: string
  otp?: string
  env?: Record<string, string | undefined>
  workspaces?: boolean
  /** 是否在发布前执行 git 检查 */
  gitChecks?: boolean
}


export const publish = async (project: Project, options: PublishOptions = {}): Promise<void> => {
  const { manifest, manifest: { projectDir } } = project
  const { access, tag, otp, env = process.env, workspaces, dryRun, logger, gitChecks = false } = options
  
  const args = [
    'publish',
    ...access ? [ '--access', access ] : [],
    ...tag ? [ '--tag', tag ] : [],
    ...workspaces ? [ '--recursive' ] : [],
    ...dryRun ? [ '--dry-run' ] : [],
    ...otp ? [ '--otp', otp ] : [],
    ...gitChecks ? [] : [ '--no-git-checks' ],
  ]
  
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
