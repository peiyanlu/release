import { confirm, group, note, select, text } from '@clack/prompts'
import { isPrerelease, isValidVersion } from '@peiyanlu/cli-utils'
import { abortTask, question, singlePrompt } from '@peiyanlu/cli-utils/prompts'
import { styleText } from '@peiyanlu/node-utils'
import { equals, isNotEmpty, isUndefined, nonNullable, upperFirst } from '@peiyanlu/ts-utils'
import { eq, gt, lt, type ReleaseType } from 'semver'
import {
  type MonorepoProject,
  type MonorepoProjectBumpOptions,
  type PickOverridableOptions,
  type Project,
  type ProjectBumpOptions,
  type VersionBumpType,
} from '../core/index.ts'
import { type CliStepsSkip, type ReleaserCliRunOptions } from './releaser.ts'


type VersionPromptValue = ReleaseType | 'custom' | 'ignore' | 'first'

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
  toPrerelease?: boolean
  inferred?: VersionBumpType
  customVersion?: string
}

export interface ReleaserCliPromptOptions<P extends Project = Project> {
  bump: PickOverridableOptions<P['bump']>
  run: ReleaserCliRunOptions
}


const abortMsg = '✕ Release cancelled.'


const getFixedMonorepoNextVersion = async (
  project: MonorepoProject,
  options: MonorepoProjectBumpOptions,
): Promise<string | undefined> => {
  const { version: maxVersion } = await project.getMaxVersion()
  const version = await project.manifest.getVersion()
  
  const rootVersion = lt(version, maxVersion) ? maxVersion : version
  const firstRelease = eq(version, maxVersion) && await project.isFirstRelease()
  
  let nextVersion: string | undefined
  for await (const subProject of project.getProjects()) {
    const projectOptions = await project.getBumpOptions(
      subProject,
      options,
      rootVersion,
      firstRelease,
    )
    const candidate = await subProject.getNextVersion(projectOptions)
    
    if (candidate && (!nextVersion || gt(candidate, nextVersion))) {
      nextVersion = candidate
    }
  }
  
  return nextVersion
}

const getNextVersion = async <P extends Project = Project>(
  project: P,
  options: PickOverridableOptions<P['bump']> = {},
): Promise<string | undefined> => {
  if (project.isMonorepoMode() && project.isFixedMode) {
    return getFixedMonorepoNextVersion(project, options)
  }
  
  return project.getNextVersion(options)
}

const createVersionOptions = async <P extends Project = Project>(
  project: P,
  options: PickOverridableOptions<P['bump']> = {},
  current: string,
  metadata: CreateVersionOptionsMetadata = {},
): Promise<VersionPromptOption[]> => {
  const { tagPrefix, firstRelease, preRelease, inferred, customVersion, toPrerelease } = metadata
  const noVersionHint = 'No version change'
  const bump: ProjectBumpOptions = { firstRelease }
  
  const customAndIgnoreOptions: VersionPromptOption[] = [
    toPrerelease
      ? {
        label: 'Custom Pre-Release',
        value: 'custom',
        hint: `Specify an exact pre-release version, default ${ customVersion }`,
        bump: { ...bump },
      }
      : {
        label: 'Custom',
        value: 'custom',
        hint: `Specify an exact version, default ${ customVersion }`,
        bump: { ...bump },
      },
    {
      label: 'As-Is',
      value: 'ignore',
      hint: `Don't update the version ${ current }`,
      bump: { version: current, firstRelease: false },
    },
  ]
  const preleaseOptions: VersionPromptOption[] = [
    {
      label: 'Pre-Release',
      value: 'prerelease',
      hint: await getNextVersion<P>(
        project,
        { ...options, tagPrefix, firstRelease, as: 'prerelease' },
      ) ?? noVersionHint,
      bump: { ...bump, as: 'prerelease' },
    },
  ]
  
  // 遵从本发布工具规则的第一次发布
  if (firstRelease) {
    return [
      {
        label: 'First Release',
        value: 'first',
        hint: `Release ${ current }`,
        bump: { ...bump, version: current },
      },
      ...customAndIgnoreOptions,
    ]
  }
  
  const bumpTypes: VersionBumpType[] = [ 'patch', 'minor', 'major' ]
  const versionOptions: VersionPromptOption[] = await Promise.all(
    nonNullable([ ...new Set([ inferred, ...bumpTypes ]) ])
      .map(async as => {
        return {
          label: toPrerelease
            ? equals(as, inferred) ? `Pre-${ upperFirst(as) } ✨` : `Pre-${ upperFirst(as) }`
            : equals(as, inferred) ? `${ upperFirst(as) } ✨` : upperFirst(as),
          value: as,
          hint: await getNextVersion<P>(
            project,
            { ...options, tagPrefix, firstRelease, as },
          ) ?? noVersionHint,
          bump: { ...bump, as },
        }
      }),
  )
  
  const candidates: VersionPromptOption[] = [ ...versionOptions ]
  
  // 预发布转发布
  if (preRelease && !toPrerelease) {
    candidates.unshift(
      ...preleaseOptions,
      {
        label: 'Release',
        value: 'release',
        hint: await getNextVersion<P>(
          project,
          { ...options, tagPrefix, firstRelease, as: 'release', prerelease: undefined },
        ) ?? noVersionHint,
        bump: { ...bump, as: 'release', prerelease: undefined },
      },
    )
  }
  
  // 没有配置生成预发布并且本身不是预发布
  if (!toPrerelease && !preRelease) {
    for (const as of bumpTypes) {
      candidates.push({
        label: `Pre-${ upperFirst(as) }`,
        value: `pre${ as }` as ReleaseType,
        hint: await getNextVersion<P>(
          project,
          { ...options, tagPrefix, firstRelease, as, prerelease: '' },
        ) ?? noVersionHint,
        bump: { ...bump, as, prerelease: '' },
      })
    }
  }
  
  candidates.push(...customAndIgnoreOptions)
  
  if (!toPrerelease) {
    // 保留第一个选项作为目标版本；例如，`patch` 和 `release` 都会生成当前预发行版本的稳定版本。
    const seen = new Set<string>()
    return candidates.filter(({ hint }) => {
      if (hint === noVersionHint || seen.has(hint)) {
        return false
      }
      seen.add(hint)
      return true
    })
  }
  
  return candidates
}

const getCustomVersionInfo = async <P extends Project = Project>(
  project: P,
  options: PickOverridableOptions<P['bump']> = {},
  current: string,
  inferred?: VersionBumpType,
  firstRelease?: boolean,
) => {
  let useCustom = false
  let customVersion = current
  const nextVersion = await getNextVersion(project, {
    ...options,
    as: inferred ?? (isNotEmpty(options.prerelease) ? 'patch' : undefined),
    firstRelease,
  })
  
  if (project.isMonorepoMode() && project.isFixedMode) {
    const { version: maxVersion, packages } = await project.getMaxVersion()
    if (lt(current, maxVersion)) {
      useCustom = true
      customVersion = nextVersion ?? maxVersion
      
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
  } else {
    customVersion = nextVersion ?? current
  }
  
  return { useCustom, customVersion }
}

const runVersionPrompts = async <P extends Project = Project>(
  project: P,
  tagPrefix?: string,
  bumpOptions: PickOverridableOptions<P['bump']> = {},
  ci = false,
  dryRun = false,
) => {
  const promptsRes: PickOverridableOptions<P['bump']> = {}
  
  const inferred = await project.inferReleaseType({ ...bumpOptions, tagPrefix })
  
  const name = await project.manifest.getName()
  const current = await project.manifest.getVersion()
  
  const firstRelease = await project.isFirstRelease({ tagPrefix })
  const preRelease = Boolean(await project.manifest.getPrereleaseVersion())
  const toPrerelease = equals(bumpOptions.as, 'prerelease') || isNotEmpty(bumpOptions.prerelease)
  
  const { useCustom, customVersion } = await getCustomVersionInfo(
    project,
    bumpOptions,
    current,
    inferred,
    firstRelease,
  )
  
  const versionOptions = await createVersionOptions<P>(
    project,
    bumpOptions,
    current,
    {
      tagPrefix,
      firstRelease,
      inferred,
      customVersion,
      preRelease,
      toPrerelease,
    },
  )
  
  const find = (val: string) => versionOptions.find(({ value }) => value === val)
  
  const initialValue = useCustom
    ? 'custom'
    : toPrerelease
      ? inferred && find(inferred)
        ? inferred
        : 'patch'
      : firstRelease
        ? 'first'
        : inferred && find(inferred)
          ? inferred
          : preRelease && find('prerelease')
            ? 'prerelease'
            : 'ignore'
  
  const type = ci ? initialValue : await singlePrompt(
    () => select({
      message: question(`Select "${ styleText.cyan`${ name }` }" release version type:`, dryRun),
      options: versionOptions,
      initialValue,
    }),
    abortMsg,
  )
  
  if (equals(type, 'custom')) {
    promptsRes.version = ci ? customVersion : await singlePrompt(
      () => text({
        message: question(`Enter "${ styleText.cyan`${ name }` }" release version:`, dryRun),
        initialValue: customVersion,
        placeholder: customVersion,
        validate: (val) => {
          if (isUndefined(val) || !isValidVersion(val)) {
            return 'Invalid version.'
          }
          if (toPrerelease && !isPrerelease(val)) {
            return 'A pre-release version is required by the configured options.'
          }
        },
      }),
      abortMsg,
    )
  }
  
  const selected = find(type)
  Object.assign(promptsRes, selected?.bump)
  
  return promptsRes
}


export const runBumpPrompts = async <P extends Project = Project>(
  project: P,
  options: ReleaserCliPromptOptions<P>,
): Promise<PickOverridableOptions<P['bump']>> => {
  const { bump: bumpOpts, run } = options
  const { dryRun = false, ci = false } = run
  
  const result: PickOverridableOptions<P['bump']> = {}
  
  if (project.isMonorepoMode() && project.isIndependentMode) {
    for await (const subProject of project.getProjects()) {
      const name = await subProject.manifest.getName()
      
      const finalOpts = (_ => {
        const { byProject, ...bumpOptions } = bumpOpts as MonorepoProjectBumpOptions
        const byProjected = byProject?.[name]
        return {
          ...bumpOptions,
          ...byProjected,
          byProjected,
        }
      })()
      
      if (finalOpts.version || finalOpts.as || finalOpts.snapshot) {
        ;((result as MonorepoProjectBumpOptions).byProject ??= {})[name] = { ...finalOpts.byProjected }
        continue
      }
      
      const options = await project.getBumpOptions(subProject, bumpOpts)
      
      ;((result as MonorepoProjectBumpOptions).byProject ??= {})[name] = {
        ...finalOpts.byProjected,
        ...await runVersionPrompts(subProject, options.tagPrefix, options, ci, dryRun),
      }
    }
  } else {
    if (bumpOpts.version || bumpOpts.as || bumpOpts.snapshot) {
      return result
    } else {
      Object.assign(
        result,
        await runVersionPrompts(project, undefined, bumpOpts, ci, dryRun),
      )
    }
  }
  
  return result
}

export const runSkippedStepsPrompts = async (options: ReleaserCliRunOptions): Promise<CliStepsSkip> => {
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
      () => confirm({ message: question(styleText.red('Confirm start workflow?'), dryRun) }),
      abortMsg,
    )
  if (!ok) {
    abortTask()
  }
}
