import {
  getAuthenticatedUser,
  getPackageInfo,
  getPublishedVersion,
  hasWriteAccess,
  pingRegistry,
  publishPackage,
  resolvePublishTag,
} from '@peiyanlu/cli-utils'
import { blue, cyan, green, magenta, red, underline, yellow } from 'ansis'
import { MSG } from '../messages.js'
import { ReleaseContext, ResolvedConfig } from '../types.js'


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
  const { npm: { publish, publishArgs }, getPkgDir } = config
  
  if (!publish) return
  
  const otpArgs = otp ? [ '--otp', otp ] : []
  const dryRunArg = dryRun ? [ '--dry-run' ] : []
  
  return publishPackage({
    tag,
    args: [ ...otpArgs, ...publishArgs, ...dryRunArg ],
    cwd: getPkgDir(selectedPkg),
  })
}


interface PublishTagOptions {
  /**
   * 支持通过命令行参数提供
   * @example v1.0.0; pkg@1.0.1;
   * @example my-cli v1.0.0;
   */
  gitTag?: string
  /** @defaults `@` */
  tagSeparator?: string
  /**
   * monorepo 仓库子包不使用 `pkg@version` 格式创建 tag 时需要指定
   * @example pkg-demo
   */
  defaultPackage?: string
  /**
   * @example (pkg) => `packages/${pkg}`; (pkg) => '.';
   */
  getPkgDir?: (pkg: string) => string
  /** npm Trusted Publishing（OIDC） */
  provenance?: boolean
}

export const publishTagToNpm = async (options: PublishTagOptions) => {
  const { gitTag, defaultPackage, tagSeparator = '@', getPkgDir = () => '.', provenance } = options
  
  const tag = process.argv.slice(2)[0] || gitTag
  
  if (!tag) {
    throw new Error(`❌ No git tag specified.`)
  }
  
  console.log(`\n📦 Start publishing from git tag: ${ cyan(tag) }`)
  
  let pkgName = defaultPackage
  let version
  
  if (tag.includes(tagSeparator)) {
    [ pkgName, version ] = tag.split(tagSeparator)
    console.log(`🔍 Parsed tag → package: "${ yellow(pkgName) }", version: "${ green(version) }"`)
  } else {
    version = tag
    console.log(`🔍 Parsed tag → version only: "${ green(version) }"`)
  }
  
  if (version.startsWith('v')) {
    version = version.slice(1)
    console.log(`✂️  Normalized version (strip v): ${ version }`)
  }
  
  if (!pkgName) {
    throw new Error(`❌ Package name should be specified in tag "${ tag }" when defaultPackage is not set`)
  }
  
  console.log(`📁 Resolving package info for "${ magenta(pkgName) }"...`)
  
  const { pkg, pkgDir } = getPackageInfo(pkgName, getPkgDir)
  
  
  console.log(`📄 package.json → name: ${ yellow(pkg.name) }, version: ${ green(pkg.version) }`)
  console.log(`📂 Package directory: ${ underline(pkgDir) }`)
  
  if (pkg.version !== version) {
    throw new Error(`❌ Package version from tag "${ version }" mismatches with current version "${ pkg.version }"`)
  }
  
  const publishTag = await resolvePublishTag(pkg.name, version)
  
  console.log(`🏷 Resolved npm dist-tag: "${ blue(publishTag) }" (version ${ green(version) })`)
  console.log(`🚀 Publishing "${ red`${ pkg.name }@${ version }` }" to npm...`)
  
  await publishPackage({
    tag: publishTag,
    args: provenance ? [ '--provenance' ] : [],
    cwd: pkgDir,
  })
  
  console.log(`🎉 Successfully published ${ red`${ pkg.name }@${ version }` } with dist-tag "${ blue(publishTag) }"\n`)
}
