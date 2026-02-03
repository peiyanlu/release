import { select, text } from '@clack/prompts'
import { isValid } from '@peiyanlu/cli-utils'
import { inc } from 'semver'
import { MSG } from '../messages.js'
import { abortSinglePrompt } from '../prompts.js'
import { ReleaseContext, ResolvedConfig } from '../types.js'
import { question } from '../utils.js'


export enum Release {
  MAJOR = 'major',
  MINOR = 'minor',
  PATCH = 'patch',
  RELEASE = 'release',
}

export enum PreRelease {
  MAJOR = 'premajor',
  MINOR = 'preminor',
  PATCH = 'prepatch',
  RELEASE = 'prerelease',
}

export enum PreId {
  ALPHA = 'alpha',
  BETA = 'beta',
  RC = 'rc',
  NET = 'next',
  CANARY = 'canary',
  NIGHT = 'nightly',
  DEV = 'dev',
}

const createVersionMap = (current: string) => ({
  patch: inc(current, Release.PATCH)!,
  minor: inc(current, Release.MINOR)!,
  major: inc(current, Release.MAJOR)!,
  
  release: inc(current, Release.RELEASE)!,
  prerelease: inc(current, PreRelease.RELEASE)!,
  
  prepatch: inc(current, PreRelease.PATCH, PreId.BETA)!,
  preminor: inc(current, PreRelease.MINOR, PreId.BETA)!,
  premajor: inc(current, PreRelease.MAJOR, PreId.BETA)!,
})

const option = (label: string, value: string, hint?: string) => ({
  label,
  value,
  hint: hint ?? value,
})


export const runVersionPrompts = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { pkg: { current, fromPreRelease } } = ctx
  
  const selectVersion = async () => {
    const versions = createVersionMap(current)
    
    const options = [
      ...(fromPreRelease
        ? [ option('Pre-Release', 'prerelease', versions.prerelease) ]
        : []),
      
      option('Patch', 'patch', versions.patch),
      option('Minor', 'minor', versions.minor),
      option('Major', 'major', versions.major),
      
      ...(!fromPreRelease
        ? [
          option('Pre-Patch', 'prepatch', versions.prepatch),
          option('Pre-Minor', 'preminor', versions.preminor),
          option('Pre-Major', 'premajor', versions.premajor),
        ]
        : []),
      
      option('As-Is', 'ignore', current),
      option('Custom', 'custom', 'custom specified'),
    ]
    
    const type = await select({
      message: question(MSG.PROMPT.SELECT_VERSION, 'version'),
      options,
      initialValue: fromPreRelease ? 'prerelease' : 'patch',
    }) as string
    
    abortSinglePrompt(type)
    return type
  }
  
  const inputVersion = async () => {
    const version = await text({
      message: question(MSG.PROMPT.INPUT_VERSION, 'version'),
      initialValue: current,
      validate: (val) => {
        if (!isValid(val)) {
          return 'Invalid version'
        }
      },
    }) as string
    abortSinglePrompt(version)
    return version
  }
  
  const resolveNextVersion = async (type: string, current: string) => {
    if (type === 'ignore') return current
    if (type === 'custom') return inputVersion()
    
    const versions = createVersionMap(current)
    return versions[type as keyof typeof versions]
  }
  
  const type = await selectVersion()
  return await resolveNextVersion(type, current)
}
