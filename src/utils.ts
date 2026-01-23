import { log } from '@clack/prompts'
import { execAsync, readJsonFile } from '@peiyanlu/cli-utils'
import { castArray } from '@peiyanlu/ts-utils'
import { dim, green, rgb, yellow } from 'ansis'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { inspect } from 'node:util'
import { getLatestTag } from './git/commit.js'
import { HookConfig, ReleaseContext, ReleaseHookKey, ResolvedConfig } from './types.js'


export const info = (msg: string) => {
  console.log(`${ rgb(33, 91, 184)(`i`) } ${ msg }`)
}

export const msg = (prefix: string, msg: string) => {
  log.message(`${ rgb(33, 91, 184)(`[${ prefix }]`) } ${ dim(msg) }`)
}

export const question = (msg: string, type: 'package' | 'version' | 'git' | 'npm' | 'github') => {
  const map = {
    package: yellow,
    version: green,
    git: rgb(220, 94, 62),
    npm: rgb(186, 70, 61),
    github: rgb(64, 110, 228),
  }
  
  return `${ map[type]`?` } ${ msg }`
}

export const success = (msg: string, dryRun: boolean) => {
  const color = dryRun ? rgb(123, 115, 66) : green
  return `${ color('✔') } ${ msg }`
}


export const runLifeCycleHook = async (hooks: HookConfig, key: ReleaseHookKey, dryRun: boolean) => {
  const handler = hooks[key]
  
  if (typeof handler === 'function') {
    if (!dryRun) await handler(log)
    log.success(success(`${ dim`run` } ${ inspect(handler) }`, dryRun))
    return
  }
  
  return Promise.allSettled(castArray(handler).filter(Boolean).map(async hook => {
    if (!dryRun) await execAsync(hook).catch(log.error)
    log.success(success(hook.replace(/^echo$/, dim('echo')), dryRun))
  }))
}

export const gitRollback = (ctx: ReleaseContext) => {
  const { git: { currentTag, isCommitted, isTagged } } = ctx
  
  spawnSync('git', [ 'restore', '.' ])
  
  if (isTagged) {
    spawnSync('git', [ 'tag', '--delete', currentTag ])
  }
  
  spawnSync('git', [ 'reset', '--hard', isCommitted ? 'HEAD~1' : 'HEAD' ])
}

export const diff = (from: string, to: string, separator: string = '.') => {
  const a = from.split(separator)
  const b = to.split(separator)
  
  return b
    .map((v, i) => (v === a[i]) ? dim(v) : green(v))
    .join(separator)
}

export const stripNewlines = (str: string) =>
  str.replace(/^\n|\n(\s+)?$/g, '')

export const formatTemplate = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { pkg: { next }, selectedPkg } = ctx
  const { git: { commitMessage: cm, tagMessage: tm }, github: { releaseName: rm }, toTag } = config
  
  const f = (s: string, v: string) => s.replace('${tag}', v)
  
  const latestTag = await getLatestTag() ?? ''
  const currentTag = toTag(selectedPkg, next)
  
  const commitMessage = f(cm, currentTag)
  const tagMessage = f(tm, currentTag)
  const releaseName = f(rm, currentTag)
  
  Object.assign(ctx.git, { latestTag, currentTag, commitMessage, tagMessage })
  Object.assign(ctx.github, { releaseName })
}


export const getPackageInfo = (pkgName: string, getPkgDir: (pkg: string) => string = (pkg) => `packages/${ pkg }`) => {
  const pkgDir = resolve(getPkgDir(pkgName))
  const pkgPath = resolve(pkgDir, 'package.json')
  const pkg = readJsonFile(pkgPath) as {
    name: string;
    version: string;
    private?: boolean;
    publishConfig?: {
      access: string
      registry: string
      [key: string]: string
    };
  }
  
  return { pkg, pkgDir, pkgPath }
}
