import { cancel, confirm, group, isCancel, note, select, text } from '@clack/prompts'
import { isPrerelease, isValidVersion } from '@peiyanlu/cli-utils'
import { equals, isUndefined, type MaybePromise } from '@peiyanlu/ts-utils'
import { red, yellow } from 'ansis'
import { inc, lt, type ReleaseType } from 'semver'
import {
  type MonorepoProjectBumpOptions,
  type PickOverridableOptions,
  type Project,
  type ProjectBumpOptions,
  type ReleaserStepsOptions,
} from '../core/index.js'
import type { ReleaserCliRunOptions } from './releaser.js'


export interface ReleaserCliPromptOptions<P extends Project = Project> {
  bump?: PickOverridableOptions<P['bump']>
  run?: ReleaserCliRunOptions
}

type VersionPromptValue = ReleaseType | 'custom' | 'ignore' | 'initial'

interface VersionPromptOption {
  label: string
  value: VersionPromptValue
  hint: string
  bump?: ProjectBumpOptions
}


const abortTask = (msg?: string) => {
  cancel(`${ red('✕') } ${ msg ?? 'Release cancelled.' }`)
  process.exit(0)
}

const singlePrompt = async <T>(fn: () => MaybePromise<T>, abortMsg?: string): Promise<T> => {
  const value = await fn()
  
  if (isCancel(value)) {
    abortTask(abortMsg)
  }
  
  return value
}

const question = (msg: string, dryRun?: boolean) => {
  const color = dryRun ? yellow : red
  return `${ color('?') } ${ msg }`
}


const getVersionHint = async <P extends Project = Project>(
  project: P,
  options: PickOverridableOptions<P['bump']> = {},
) => await project.getNextVersion(options) ?? 'No version change'


const createVersionOptions = async <P extends Project = Project>(
  project: P,
  options: PickOverridableOptions<P['bump']> = {},
  current: string,
  tagPrefix?: string,
): Promise<VersionPromptOption[]> => {
  const firstRelease = await project.isFirstRelease({ tagPrefix })
  
  if (firstRelease) {
    return [
      {
        label: 'Initial release',
        value: 'initial',
        hint: `Release ${ current }`,
        bump: { version: current },
      },
      {
        label: 'Custom',
        value: 'custom',
        hint: 'Specify an exact version',
      },
      {
        label: 'As-is',
        value: 'ignore',
        hint: `Do not update the version ${ current }`,
        bump: { skip: true },
      },
    ]
  }
  
  const fromPreRelease = isPrerelease(current)
  const candidates: VersionPromptOption[] = [
    {
      label: fromPreRelease ? 'Release' : 'Patch',
      value: 'patch',
      hint: await getVersionHint<P>(project, { ...options, tagPrefix, as: 'patch' }),
      bump: { as: 'patch' },
    },
    {
      label: 'Minor',
      value: 'minor',
      hint: await getVersionHint<P>(project, { ...options, tagPrefix, as: 'minor' }),
      bump: { as: 'minor' },
    },
    {
      label: 'Major',
      value: 'major',
      hint: await getVersionHint<P>(project, { ...options, tagPrefix, as: 'major' }),
      bump: { as: 'major' },
    },
  ]
  
  if (fromPreRelease) {
    candidates.unshift({
      label: 'Pre-release',
      value: 'prerelease',
      hint: await getVersionHint<P>(project, { ...options, tagPrefix, as: 'prerelease' }),
      bump: { as: 'prerelease' },
    })
  } else {
    for (const as of [ 'patch', 'minor', 'major' ] as const) {
      candidates.push({
        label: `Pre-${ as[0].toUpperCase() }${ as.slice(1) }`,
        value: `pre${ as }` as ReleaseType,
        hint: await getVersionHint<P>(project, { ...options, tagPrefix, as, prerelease: 'beta' }),
        bump: { as, prerelease: 'beta' },
      })
    }
  }
  
  candidates.push(
    {
      label: 'Custom',
      value: 'custom',
      hint: 'Specify an exact version',
    },
    {
      label: 'As-is',
      value: 'ignore',
      hint: `Do not update the version ${ current }`,
      bump: { skip: true },
    },
  )
  
  return candidates
}

const runBumpPrompts = async <P extends Project = Project>(
  project: P,
  options: ReleaserCliPromptOptions<P> = {},
): Promise<PickOverridableOptions<P['bump']>> => {
  const { bump: bumpOpts = {}, run = {} } = options
  const bump = { ...bumpOpts } as PickOverridableOptions<P['bump']>
  const { dryRun = false, ci = false } = run
  
  if (bump.version || bump.as || bump.snapshot || bump.skip) {
    return bump
  }
  
  const runVersionPrompts = async <P extends Project = Project>(project: P, tagPrefix?: string) => {
    const promptsRes: PickOverridableOptions<P['bump']> = {}
    
    const inferred = await project.inferReleaseType({ ...bump, tagPrefix })
    const name = await project.manifest.getName()
    const current = await project.manifest.getVersion()
    
    let useCustom = false
    let customVersion = current
    if (project.isMonorepoMode() && project.isFixedMode) {
      const { version: maxVersion, packages } = await project.computeMaxVersion()
      if (lt(current, maxVersion)) {
        useCustom = true
        customVersion = inc(maxVersion, inferred ?? 'patch')!
        
        note(
          `
            Current version: ${ current }
            Highest package version: ${ maxVersion }
            Packages at this version:\n${ packages.map(name => `- ${ name }`).join('\n') }
            
            Minimum release version: ${ maxVersion }
            Suggested release version: ${ customVersion } (used in CI)
          `.trim(),
          'Monorepo version mismatch',
          {
            format(line) {
              return line.trim()
            },
          },
        )
      }
    }
    
    const versionOptions = await createVersionOptions<P>(project, bump, current, tagPrefix)
    
    const find = (val: string) =>
      versionOptions.find(option => option.value === val)
    
    const fromPreRelease = isPrerelease(current)
    const initialValue = useCustom
      ? 'custom'
      : inferred && find(inferred)
        ? inferred
        : fromPreRelease && find('prerelease')
          ? 'prerelease'
          : 'patch'
    
    const type = ci ? initialValue : await singlePrompt(
      () => select({
        message: question(`Select "${ name }" release version type:`, dryRun),
        options: versionOptions,
        initialValue,
      }),
    ) as VersionPromptValue
    
    if (equals(type, 'custom')) {
      promptsRes.version = ci ? customVersion : await singlePrompt(
        () => text({
          message: question('Enter release version:', dryRun),
          initialValue: customVersion,
          placeholder: customVersion,
          validate: (val) => {
            if (isUndefined(val) || !isValidVersion(val)) {
              return 'Invalid version.'
            }
          },
        }),
      ) as string
    } else {
      const selected = find(type)
      Object.assign(promptsRes, selected?.bump)
    }
    
    return promptsRes
  }
  
  if (project.isMonorepoMode() && project.isIndependentMode) {
    for await (const subProject of project.getProjects()) {
      const name = await subProject.manifest.getName()
      const scope = await project.getScope(name)
      const tagPrefix = await project.getTagPrefix(scope)
      
      const monoBump = bump as MonorepoProjectBumpOptions
      
      ;(monoBump.byProject ??= {})[name] = {
        ...monoBump.byProject?.[name],
        ...await runVersionPrompts(subProject, tagPrefix),
      }
    }
  } else {
    const result = await runVersionPrompts(project)
    Object.assign(bump, result)
  }
  
  return bump
}


export const getCliPromptOptions = async <P extends Project = Project>(
  project: P,
  options: ReleaserCliPromptOptions<P> = {},
): Promise<ReleaserStepsOptions<P>> => {
  const { run = {} } = options
  const { dryRun = false, ci = false } = run
  
  const bumpOptions = await runBumpPrompts(project, options)
  
  const shouldPrompt = (v: unknown) => !ci && (isUndefined(v) || dryRun)
  
  const res = await group(
    {
      commit: () => run.skipGit
        ? Promise.resolve(false)
        : shouldPrompt(run.skipGit)
          ? confirm({ message: question('Commit release changes?', dryRun) }) as Promise<boolean>
          : Promise.resolve(true),
      tag: () => run.skipGit
        ? Promise.resolve(false)
        : shouldPrompt(run.skipGit)
          ? confirm({ message: question('Create release tags?', dryRun) }) as Promise<boolean>
          : Promise.resolve(true),
      push: () => run.skipGit
        ? Promise.resolve(false)
        : shouldPrompt(run.skipGit)
          ? confirm({ message: question('Push release changes?', dryRun) }) as Promise<boolean>
          : Promise.resolve(true),
      
      publish: () => run.skipPublish
        ? Promise.resolve(false)
        : shouldPrompt(run.skipPublish)
          ? confirm({ message: question('Publish package?', dryRun) }) as Promise<boolean>
          : Promise.resolve(true),
      
      release: () => run.skipRelease || run.skipGit
        ? Promise.resolve(false)
        : shouldPrompt(run.skipRelease)
          ? confirm({ message: question('Create repository release?', dryRun) }) as Promise<boolean>
          : Promise.resolve(true),
    },
    {
      onCancel: () => {
        abortTask(`Release cancelled.`)
      },
    },
  )
  
  return {
    bump: bumpOptions,
    commit: {
      skip: !res.commit,
    },
    tag: {
      skip: !res.tag,
    },
    push: {
      skip: !res.push,
    },
    publish: {
      skip: !res.publish,
    } as PickOverridableOptions<P['publish']>,
    release: {
      skip: !res.release,
    },
  }
}

export const runConfirmPrompts = async (isCI = false, dryRun = false) => {
  const ok = isCI
    ? true
    : await singlePrompt(
      () => confirm({ message: question('Confirm start workflow?', dryRun) }),
    )
  if (!ok) {
    abortTask()
  }
}
