import { execAsync } from '@peiyanlu/cli-utils'
import { Project, type ProjectPublishOptions } from '../core/index.js'


export interface PublishOptions extends ProjectPublishOptions {
  access?: string
  registry?: string
  otp?: string
  env?: Record<string, string | undefined>
  workspaces?: boolean
}


export const publish = async (project: Project, options: PublishOptions = {}): Promise<void> => {
  const { manifest, manifest: { projectDir } } = project
  const { access, tag, otp, env = process.env, workspaces, dryRun, logger } = options
  
  const args = [
    'publish',
    ...access ? [ '--access', access ] : [],
    ...tag ? [ '--tag', tag ] : [],
    ...workspaces ? [ '--workspaces' ] : [],
    ...dryRun ? [ '--dry-run' ] : [],
    ...otp ? [ '--otp', otp ] : [],
  ]
  
  logger?.verbose(`Publishing "${ await manifest.getName() }" with command: npm ${ args.join(' ') }`)
  
  await execAsync(
    'npm',
    args,
    {
      cwd: projectDir,
      env,
      error: 'log',
    },
  )
}
