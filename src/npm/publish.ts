import { log } from '@clack/prompts'
import { runNpm } from '@peiyanlu/cli-utils'
import { dim, underline } from 'ansis'
import { gt } from 'semver'
import { MSG } from '../messages.js'
import { ReleaseContext, ResolvedConfig } from '../types.js'
import { parseVersion } from '../version/bump.js'


export const getRegistry = (publishConfig: Record<string, string> = {}) => {
  const registries = publishConfig.registry
    ? [ publishConfig.registry ]
    : Object.keys(publishConfig)
      .filter(key => key.endsWith('registry'))
      .map(key => publishConfig[key])
  return registries[0]
}


export const isRegistryUp = async (registry?: string) => {
  const registryArg = registry ? [ '--registry', registry ] : []
  const cmd = [ 'ping', ...registryArg ]
  return (undefined !== await runNpm(cmd))
}


export const isAuthenticated = (registry?: string) => {
  const registryArg = registry ? [ '--registry', registry ] : []
  const cmd = [ 'whoami', ...registryArg ]
  return runNpm(cmd)
}


export const getLatestRegistryVersion = (name: string, tag: string, registry?: string) => {
  const registryArg = registry ? [ '--registry', registry ] : []
  const cmd = [ 'show', `${ name }@${ tag }`, 'version', ...registryArg ]
  return runNpm(cmd)
}


export const getRegistryTags = async (name: string, registry?: string) => {
  const registryArg = registry ? [ '--registry', registry ] : []
  const cmd = [ 'view', name, 'dist-tags', '--json', ...registryArg ]
  const res = await runNpm(cmd)
  return Object.keys(JSON.parse(res || '{}'))
}

export const bump = (version: string, allowSameVersion?: boolean, args: string[] = []) => {
  allowSameVersion && args.push(`--allow-same-version`)
  return runNpm([
    'version',
    version,
    '--no-git-tag-version',
    '--workspaces=false',
    ...args,
  ])
}

export const resolveTag = async (version: string) => {
  const { toPreRelease, preId } = parseVersion(version)
  if (!toPreRelease) {
    return 'latest'
  } else {
    return preId || 'next'
  }
}

export const isCollaborator = async (ctx: ReleaseContext) => {
  const { pkg: { name, publishConfig }, npm: { username } } = ctx
  const registry = getRegistry(publishConfig)
  const registryArg = registry ? [ '--registry', registry ] : []
  
  let npmVersion = await runNpm([ '--version' ])
  
  let accessCommand
  if (gt(npmVersion!, '9.0.0')) {
    accessCommand = [ 'access', 'list', 'collaborators', '--json' ]
  } else {
    accessCommand = [ 'access', 'ls-collaborators' ]
  }
  
  const cmd = [ ...accessCommand, name, ...registryArg ]
  const res = await runNpm(cmd)
  
  if (res) {
    const collaborators = JSON.parse(res ?? '{}')
    const permissions = collaborators[username]
    return permissions && permissions.includes('write')
  }
  
  log.error(`Unable to verify if user ${ username } is a collaborator for ${ name }.`)
}


export const getPackageUrl = (ctx: ReleaseContext) => {
  const { pkg: { name, next } } = ctx
  return `https://www.npmjs.com/package/${ name }/v/${ next }`
}


export const npmCheck = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { pkg: { name, current, publishConfig }, npm: { username } } = ctx
  const { npm: { skipChecks } } = config
  const registry = getRegistry(publishConfig)
  const tag = await resolveTag(current)
  
  Object.assign(ctx.npm, { tag })
  
  if (skipChecks) return ''
  
  // npm ping
  const ping = await isRegistryUp()
  if (!ping) {
    throw new Error(MSG.ERROR.NPM_REGISTRY(registry))
  }
  
  // npm whoami
  const getUser = async () => {
    const username = await isAuthenticated(registry)
    if (!username) return false
    Object.assign(ctx.npm, { username })
    return true
  }
  const isAuthed = await getUser()
  if (!isAuthed) {
    throw new Error(MSG.ERROR.NPM_AUTH)
  }
  
  // npm show project@latest version
  const latestPublish = await getLatestRegistryVersion(name, tag, registry)
  if (latestPublish) {
    // npm access list collaborators --json
    if (!(await isCollaborator(ctx))) {
      throw new Error(MSG.ERROR.NPM_USER(username, name))
    }
  }
  
  return underline(dim(latestPublish ? `(latest is ${ latestPublish })` : '(new publish)'))
}

export const isOtpError = (err: Error) => /one-time password|otp/i.test(err.message)


export const publishNpm = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { dryRun, npm: { otp, tag }, pkg: { publishConfig } } = ctx
  const { npm: { publish, publishPath, pushArgs } } = config
  const registry = getRegistry(publishConfig)
  
  if (!publish) return
  
  const otpArgs = otp ? [ '--otp', otp ] : []
  const dryRunArg = dryRun ? [ '--dry-run' ] : []
  const registryArg = registry ? [ '--registry', registry ] : []
  
  return runNpm([
    'publish',
    publishPath,
    '--tag',
    tag,
    '--workspaces=false',
    ...otpArgs,
    ...pushArgs,
    ...registryArg,
    ...dryRunArg,
  ])
}
