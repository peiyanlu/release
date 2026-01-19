import { select, text } from '@clack/prompts'
import { gte, inc } from 'semver'
import { MSG } from '../messages.js'
import { abortSinglePrompt } from '../prompts.js'
import { ReleaseContext, ResolvedConfig } from '../types.js'
import { question } from '../utils.js'
import { isValid } from './bump.js'


export enum Release {
  MAJOR = 'major',
  MINOR = 'minor',
  PATCH = 'patch',
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


export const runVersionPrompts = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { pkg: { current, fromPreRelease } } = ctx
  
  const selectVersion = async () => {
    const patch = inc(current, Release.PATCH)!
    const minor = inc(current, Release.MINOR)!
    const major = inc(current, Release.MAJOR)!
    
    const prerelease = inc(current, PreRelease.RELEASE)!
    
    const prepatch = inc(current, PreRelease.PATCH, PreId.BETA)!
    const preminor = inc(current, PreRelease.MINOR, PreId.BETA)!
    const premajor = inc(current, PreRelease.MAJOR, PreId.BETA)!
    
    const pr = [
      {
        label: 'Pre-Release',
        value: prerelease,
        hint: prerelease,
      },
    ]
    const pre = [
      {
        label: 'Pre-Patch',
        value: prepatch,
        hint: prepatch,
      },
      {
        label: 'Pre-Minor',
        value: preminor,
        hint: preminor,
      },
      {
        label: 'Pre-Major',
        value: premajor,
        hint: premajor,
      },
    ]
    const release = [
      {
        label: 'Patch',
        value: patch,
        hint: patch,
      },
      {
        label: 'Minor',
        value: minor,
        hint: minor,
      },
      {
        label: 'Major',
        value: major,
        hint: major,
      },
    ]
    const custom = [
      {
        label: 'As-Is',
        value: 'ignore',
        hint: current,
      },
      {
        label: 'Custom',
        value: 'custom',
        hint: 'custom specified',
      },
    ]
    
    const version = await select({
      message: question(MSG.PROMPT.SELECT_VERSION, 'version'),
      options: [
        ...(fromPreRelease ? pr : []),
        ...release,
        ...(fromPreRelease ? [] : pre),
        ...custom,
      ],
      initialValue: fromPreRelease ? prerelease : patch,
    }) as string
    abortSinglePrompt(version)
    return version
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
  
  const type = await selectVersion()
  const next: string =
    type === 'custom'
      ? await inputVersion()
      : type === 'ignore'
        ? current
        : type
  
  ctx.isIncrement = gte(next, current)
  
  
  return { next }
}
