import {
  getAuthenticatedUser,
  getPublishedVersion,
  hasWriteAccess,
  pingRegistry,
  publishPackage,
} from '@peiyanlu/cli-utils'
import { lt } from 'semver'
import { MSG } from '../messages.js'
import { ReleaseContext, ResolvedConfig } from '../types.js'
import { parseVersion } from '../version/bump.js'


export const resolvePublishTag = async (pkgName: string, version: string) => {
  const { toPreRelease, preId } = parseVersion(version)
  if (!toPreRelease) {
    const active = await getPublishedVersion(pkgName)
    return (active && lt(version, active)) ? 'previous' : 'latest'
  } else {
    return preId || 'prerelease'
  }
}

export const isOtpError = (err: unknown) =>
  err instanceof Error && /one-time password|otp/i.test(err.message)

export const npmCheck = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { pkg: { name, current, publishConfig: { registry } } } = ctx
  const { npm: { skipChecks } } = config
  const tag = await resolvePublishTag(name, current)
  
  Object.assign(ctx.npm, { tag })
  
  if (skipChecks) return ''
  
  const [ pinged, username ] = await Promise.all([ pingRegistry(registry), getAuthenticatedUser(registry) ])
  
  if (!pinged) {
    throw new Error(MSG.ERROR.NPM_REGISTRY(registry))
  }
  if (!username) {
    throw new Error(MSG.ERROR.NPM_AUTH)
  }
  
  Object.assign(ctx.npm, { username })
  
  const latest = await getPublishedVersion(`${ name }@${ tag }`)
  if (latest) {
    if (!(await hasWriteAccess(name, username, registry))) {
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
  
  return publishPackage({
    tag,
    args: [ ...otpArgs, ...pushArgs, ...dryRunArg ],
    cwd: getPkgDir(selectedPkg),
  })
}
