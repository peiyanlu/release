import { cancel, confirm, group, isCancel, note, select, text } from '@clack/prompts'
import { isValidVersion } from '@peiyanlu/cli-utils'
import { equals, isUndefined, type MaybePromise, nonNullable, upperFirst } from '@peiyanlu/ts-utils'
import { cyan, red, yellow } from 'ansis'
import { inc, lt, type ReleaseType } from 'semver'
import {
  type MonorepoProjectBumpOptions,
  type PickOverridableOptions,
  type Project,
  type ProjectBumpOptions,
} from '../core/index.js'
import { type CliStepsSkip, type ReleaserCliRunOptions } from './releaser.js'


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

interface CreateVersionOptionsMetadata {
  tagPrefix?: string
  firstRelease?: boolean
  preRelease?: boolean
  inferred?: string
  customVersion?: string
}


const abortTask = (msg?: string): never => {
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

const question = (msg: string, dryRun?: boolean): string => {
  const color = dryRun ? yellow : red
  return `${ color('?') } ${ msg }`
}


const getVersionHint = async <P extends Project = Project>(
  project: P,
  options: PickOverridableOptions<P['bump']> = {},
): Promise<string> => await project.getNextVersion(options) ?? 'No version change'

const createVersionOptions = async <P extends Project = Project>(
  project: P,
  options: PickOverridableOptions<P['bump']> = {},
  current: string,
  metadata: CreateVersionOptionsMetadata = {},
): Promise<VersionPromptOption[]> => {
  const { tagPrefix, firstRelease, preRelease, inferred, customVersion } = metadata
  
  const release: VersionPromptOption[] = await Promise.all(
    nonNullable([ ...new Set([ inferred, 'patch', 'minor', 'major' ]) ] as ReleaseType[])
      .map(async as => {
        return {
          label: equals(as, inferred) ? `${ upperFirst(as) } ✨` : upperFirst(as),
          value: as,
          hint: await getVersionHint<P>(project, { ...options, tagPrefix, as }),
          bump: { as },
        }
      }),
  )
  
  const candidates: VersionPromptOption[] = [ ...release ]
  
  if (preRelease) {
    candidates.unshift({
      label: 'Pre-release',
      value: 'prerelease',
      hint: await getVersionHint<P>(project, { ...options, tagPrefix, as: 'prerelease' }),
      bump: { as: 'prerelease' },
    })
  } else {
    for (const as of [ 'patch', 'minor', 'major' ] as const) {
      candidates.push({
        label: `Pre-${ upperFirst(as) }`,
        value: `pre${ as }` as ReleaseType,
        hint: await getVersionHint<P>(project, { ...options, tagPrefix, as, prerelease: 'beta' }),
        bump: { as, prerelease: 'beta' },
      })
    }
  }
  
  if (firstRelease) {
    candidates.length = 0
    
    candidates.push({
      label: 'Initial release',
      value: 'initial',
      hint: `Release ${ current }`,
      bump: { version: current, firstRelease },
    })
  }
  
  candidates.push(
    {
      label: 'Custom',
      value: 'custom',
      hint: `Specify an exact version, default ${ customVersion }`,
      bump: { firstRelease },
    },
    {
      label: 'As-is',
      value: 'ignore',
      hint: `Don't update the version ${ current }`,
      bump: { version: current },
    },
  )
  
  return candidates
}


export const runBumpPrompts = async <P extends Project = Project>(
  project: P,
  options: ReleaserCliPromptOptions<P> = {},
): Promise<PickOverridableOptions<P['bump']>> => {
  const { bump: bumpOpts = {}, run = {} } = options
  const bump = { ...bumpOpts } as PickOverridableOptions<P['bump']>
  const { dryRun = false, ci = false } = run
  
  if (bump.version || bump.as || bump.snapshot) {
    return bump
  }
  
  const runVersionPrompts = async <P extends Project = Project>(project: P, tagPrefix?: string) => {
    const promptsRes: PickOverridableOptions<P['bump']> = {}
    
    const firstRelease = await project.isFirstRelease({ tagPrefix })
    const inferred = await project.inferReleaseType({ ...bump, tagPrefix })
    const name = await project.manifest.getName()
    const current = await project.manifest.getVersion()
    const preRelease = Boolean(await project.manifest.getPrereleaseVersion())
    
    let useCustom = false
    let customVersion = inferred ? inc(current, inferred)! : current
    if (project.isMonorepoMode() && project.isFixedMode) {
      const { version: maxVersion, packages } = await project.getMaxVersion()
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
    
    const versionOptions = await createVersionOptions<P>(
      project,
      bump,
      current,
      {
        tagPrefix,
        firstRelease,
        inferred,
        customVersion,
        preRelease,
      },
    )
    
    const find = (val: string) => versionOptions.find(({ value }) => value === val)
    
    const initialValue = firstRelease
      ? 'initial'
      : useCustom
        ? 'custom'
        : inferred && find(inferred)
          ? inferred
          : preRelease && find('prerelease')
            ? 'prerelease'
            : 'patch'
    
    const type = ci ? initialValue : await singlePrompt(
      () => select({
        message: question(`Select "${ cyan`${ name }` }" release version type:`, dryRun),
        options: versionOptions,
        initialValue,
      }),
    ) as VersionPromptValue
    
    if (equals(type, 'custom')) {
      promptsRes.version = ci ? customVersion : await singlePrompt(
        () => text({
          message: question(`Enter "${ cyan`${ name }` }" release version:`, dryRun),
          initialValue: customVersion,
          placeholder: customVersion,
          validate: (val) => {
            if (isUndefined(val) || !isValidVersion(val)) {
              return 'Invalid version.'
            }
          },
        }),
      ) as string
    }
    
    const selected = find(type)
    Object.assign(promptsRes, selected?.bump)
    
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

export const getCliPromptOptions = async (options: ReleaserCliRunOptions = {}): Promise<CliStepsSkip> => {
  const { dryRun = false, ci = false } = options
  
  const shouldPrompt = (v: unknown) => !ci && (isUndefined(v) || dryRun)
  
  const res = await group(
    {
      commit: () => options.skipGit
        ? Promise.resolve(false)
        : shouldPrompt(options.skipGit)
          ? confirm({ message: question('Commit release changes?', dryRun) }) as Promise<boolean>
          : Promise.resolve(true),
      tag: ({ results: { commit } }) => !commit
        ? Promise.resolve(false)
        : shouldPrompt(options.skipGit)
          ? confirm({ message: question('Create release tags?', dryRun) }) as Promise<boolean>
          : Promise.resolve(true),
      push: ({ results: { commit } }) => !commit
        ? Promise.resolve(false)
        : shouldPrompt(options.skipGit)
          ? confirm({ message: question('Push release changes?', dryRun) }) as Promise<boolean>
          : Promise.resolve(true),
      
      publish: () => options.skipPublish
        ? Promise.resolve(false)
        : shouldPrompt(options.skipPublish)
          ? confirm({ message: question('Publish project?', dryRun) }) as Promise<boolean>
          : Promise.resolve(true),
      
      release: () => options.skipRelease
        ? Promise.resolve(false)
        : shouldPrompt(options.skipRelease)
          ? confirm({ message: question('Create repository release?', dryRun) }) as Promise<boolean>
          : Promise.resolve(true),
    },
    {
      onCancel: () => {
        abortTask()
      },
    },
  )
  
  return {
    commit: !res.commit,
    tag: !res.tag,
    push: !res.push,
    publish: !res.publish,
    release: !res.release,
  }
}

export const runConfirmPrompts = async (ci = false, dryRun = false): Promise<void> => {
  const ok = ci
    ? true
    : await singlePrompt(
      () => confirm({ message: question(red('Confirm start workflow?'), dryRun) }),
    )
  if (!ok) {
    abortTask()
  }
}
