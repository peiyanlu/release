import { getPackageInfo, publishPackage } from '@peiyanlu/cli-utils'
import { resolvePublishTag } from './npm/publish.js'


export { defineConfig, mergeConfig, type UserConfig } from './config.js'
export { type Logger } from './types.js'
export { getChangelog, generateChangelog, createGenerator } from './git/changelog.js'


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
  
  console.log(`\n📦 Start publishing from git tag: ${ tag }`)
  
  let pkgName = defaultPackage
  let version
  
  if (tag.includes(tagSeparator)) {
    [ pkgName, version ] = tag.split(tagSeparator)
    console.log(`🔍 Parsed tag → package: "${ pkgName }", version: "${ version }"`)
  } else {
    version = tag
    console.log(`🔍 Parsed tag → version only: "${ version }"`)
  }
  
  if (version.startsWith('v')) {
    version = version.slice(1)
    console.log(`✂️  Normalized version (strip v): ${ version }`)
  }
  
  if (!pkgName) {
    throw new Error(`❌ Package name should be specified in tag "${ tag }" when defaultPackage is not set`)
  }
  
  console.log(`📁 Resolving package info for "${ pkgName }"...`)
  
  const { pkg, pkgDir } = getPackageInfo(pkgName, getPkgDir)
  
  
  console.log(`📄 package.json → name: ${ pkg.name }, version: ${ pkg.version }`)
  console.log(`📂 Package directory: ${ pkgDir }`)
  
  if (pkg.version !== version) {
    throw new Error(`❌ Package version from tag "${ version }" mismatches with current version "${ pkg.version }"`)
  }
  
  const publishTag = await resolvePublishTag(pkg.name, version)
  
  console.log(`🏷 Resolved npm dist-tag: "${ publishTag }" (version ${ version })`)
  console.log(`🚀 Publishing "${ pkg.name }@${ version }" to npm...`)
  
  await publishPackage({
    tag: publishTag,
    args: provenance ? [ '--provenance' ] : [],
    cwd: pkgDir,
  })
  
  console.log(`✅ Successfully published ${ pkg.name }@${ version } with dist-tag "${ publishTag }"\n`)
}

