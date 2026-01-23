import { runNpm } from '@peiyanlu/cli-utils'
import { gt, lt } from 'semver'
import { MSG } from '../messages.js'
import { ReleaseContext, ResolvedConfig } from '../types.js'
import { parseVersion } from '../version/bump.js'


export const resolvePublishRegistry = (publishConfig: Record<string, string> = {}) => {
  if (publishConfig.registry) {
    return publishConfig.registry
  }
  
  const registries = Object.keys(publishConfig)
    .filter(k => k.endsWith('registry'))
    .map(k => publishConfig[k])
  
  return registries[0]
}

export const pingRegistry = async () => {
  return (undefined !== await runNpm([ 'ping' ]))
}

export const getAuthenticatedUser = () => {
  return runNpm([ 'whoami' ])
}

export const getVersionByTag = (name: string, tag: string) => {
  return runNpm([ 'show', `${ name }@${ tag }`, 'version' ])
}

export const getPublishedVersion = (name: string) => {
  return runNpm([ 'info', name, 'version' ])
}

export const resolvePublishTag = async (pkgName: string, version: string) => {
  const { toPreRelease, preId } = parseVersion(version)
  if (!toPreRelease) {
    const active = await getPublishedVersion(pkgName)
    return (active && lt(version, active)) ? 'previous' : 'latest'
  } else {
    return preId || 'prerelease'
  }
}

export const getDistTags = async (name: string) => {
  const res = await runNpm([ 'view', name, 'dist-tags', '--json' ])
  return Object.keys(JSON.parse(res || '{}'))
}

export const bumpPackageVersion = (version: string, args: string[] = [], cwd = '.') => {
  return runNpm([
    'version',
    version,
    '--no-git-tag-version',
    '--workspaces=false',
    '--allow-same-version',
    ...args,
  ], { cwd })
}

export const isOtpError = (err: unknown) =>
  err instanceof Error && /one-time password|otp/i.test(err.message)

export const publishPackage = (pkg = '.', tag = 'latest', args: string[] = []) => {
  return runNpm([
    'publish',
    '--access',
    'public',
    '--tag',
    tag,
    '--workspaces=false',
    ...args,
  ], { cwd: pkg })
}

export const getPackageUrl = (name: string, next: string) => {
  return `https://www.npmjs.com/package/${ name }/v/${ next }`
}


export const isCollaborator = async (ctx: ReleaseContext) => {
  const { pkg: { name, publishConfig }, npm: { username } } = ctx
  const registry = resolvePublishRegistry(publishConfig)
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
    const collaborators: Record<string, any> = JSON.parse(res ?? '{}')
    const permissions: string | undefined = collaborators[username]
    return permissions?.includes('write')
  }
  
  return false
}

export const npmCheck = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { pkg: { name, current, publishConfig: { registry } }, npm: { username } } = ctx
  const { npm: { skipChecks } } = config
  const tag = await resolvePublishTag(name, current)
  
  Object.assign(ctx.npm, { tag })
  
  if (skipChecks) return ''
  
  // npm ping
  const ping = await pingRegistry()
  if (!ping) {
    throw new Error(MSG.ERROR.NPM_REGISTRY(registry))
  }
  
  // npm whoami
  const getUser = async () => {
    const username = await getAuthenticatedUser()
    if (!username) return false
    Object.assign(ctx.npm, { username })
    return true
  }
  const isAuthed = await getUser()
  if (!isAuthed) {
    throw new Error(MSG.ERROR.NPM_AUTH)
  }
  
  // npm show project@latest version
  const latest = await getVersionByTag(name, tag)
  if (latest) {
    // npm access list collaborators --json
    if (!(await isCollaborator(ctx))) {
      throw new Error(MSG.ERROR.NPM_USER(username, name))
    }
  }
  
  return latest ? `(${ tag } → ${ latest })` : `(${ tag } → no published version)`
}

export const publishNpm = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { dryRun, selectedPkg, npm: { otp, tag } } = ctx
  const { npm: { publish, pushArgs }, getPkgDir } = config
  
  if (!publish) return
  
  const otpArgs = otp ? [ '--otp', otp ] : []
  const dryRunArg = dryRun ? [ '--dry-run' ] : []
  
  return publishPackage(
    getPkgDir(selectedPkg),
    tag,
    [
      ...otpArgs,
      ...pushArgs,
      ...dryRunArg,
    ],
  )
}
