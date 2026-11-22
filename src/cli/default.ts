import type { CliOptions } from '@peiyanlu/cli-utils'
import { gitConfigGet, isGitRepo, isWorkingTreeClean } from '@peiyanlu/git-utils'
import { assert, isUndefined, set } from '@peiyanlu/ts-utils'
import type { ReleaseType } from 'semver'
import { loadConfig, type UserConfig } from '../config/index.ts'
import { ReleaserCli } from '../releaser-cli/index.ts'


export const runDefaultCli = async (releaseType: ReleaseType, options: CliOptions<boolean>): Promise<void> =>{
  const { dryRun, skipWorkingTreeCheck } = options
  const { config } = Object
    .entries(options)
    .filter(([ key, value ]) => key.startsWith('config.') && !isUndefined(value))
    .reduce(
      (parsed, [ key, value ]) => {
        set(parsed, key, value)
        return parsed
      },
      { config: {} } as { config: UserConfig },
    )
  
  const { config: { project, hosting, releaser }, file } = await loadConfig<UserConfig>(process.cwd())
  assert(file, 'Config file not found.')
  assert(project, 'Project not found.')
  assert(hosting, 'GitRepositoryHosting not found.')
  
  assert(await isGitRepo(), 'Current directory is not a Git repository.')
  assert(skipWorkingTreeCheck ? true : await isWorkingTreeClean(), 'Git working tree is not clean.')
  assert(await gitConfigGet('remote.origin.url'), 'Git remote "origin" is not configured.')
  
  await new ReleaserCli({
    ...releaser,
    ...config.releaser,
    project,
    hosting,
    dryRun,
  })
    .runAction({ releaseType, ...options, config })
}
