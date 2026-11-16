import { type CliOptions } from '@peiyanlu/cli-utils'
import { gitConfigGet, isGitRepo, isWorkingTreeClean } from '@peiyanlu/git-utils'
import { readJsonFileSync } from '@peiyanlu/node-utils'
import { assert } from '@peiyanlu/ts-utils'
import { program } from 'commander'
import { join } from 'node:path'
import type { ReleaseType } from 'semver'
import { runCommitCli } from './cli/commit.ts'
import { runInitCli } from './cli/init.ts'
import { loadConfig, ReleaserCli, type UserConfig } from './index.ts'


const pkgJson = readJsonFileSync(join(__dirname, '..', 'package.json'))

program
  .name('release')
  .description(pkgJson.description)
  .version(pkgJson.version, '-v, --version', 'Print the tool version and exit.')
  .usage('[release-type] [options]')
  .argument('[release-type]', `Release type. One of 'major', 'minor', 'patch', or 'prerelease'.`)
  .enablePositionalOptions()
  .option('-n, --dry-run', 'Run in dry mode.')
  .option(
    '--pre-id <preId>',
    `Pre-release identifier. Such as 'alpha', 'beta', 'rc', 'next', 'canary', 'nightly', or 'dev'.`,
  )
  .option('--ci', 'Enable CI mode.')
  .option('--skip-bump', 'Skip updating the project version.')
  .option('--skip-git', 'Skip Git commit, tag, and push operations. Git history is still read.')
  .option('--skip-working-tree-check', 'Skip checking whether the Git working tree is clean.')
  .option('--skip-publish', 'Skip publishing the project.')
  .option('--skip-release', 'Skip creating a release on the repository hosting service.')
  .helpOption('-h, --help', 'Display help information.')
  .action(async (releaseType: ReleaseType, options: CliOptions<boolean>) => {
    const { config: { project, hosting, releaser } } = await loadConfig<UserConfig>(process.cwd())
    const { dryRun, skipWorkingTreeCheck } = options
    
    assert(await isGitRepo(), 'Current directory is not a Git repository.')
    !skipWorkingTreeCheck && assert(await isWorkingTreeClean(), 'Git working tree is not clean.')
    assert(await gitConfigGet('remote.origin.url'), 'Git remote "origin" is not configured.')
    
    assert(project, 'Project not found.')
    assert(hosting, 'GitRepositoryHosting not found.')
    
    await new ReleaserCli({
      ...releaser,
      project,
      hosting,
      dryRun,
    })
      .runAction({ releaseType, ...options })
  })

program
  .command('commit')
  .description('Create a Conventional Commit from staged changes.')
  .option('-n, --dry-run', 'Run in dry mode.')
  .option('--amend', 'Amend the previous commit with the entered message.')
  .action(runCommitCli)

program
  .command('init')
  .description('Initialize release configuration for your project.')
  .option('-n, --dry-run', 'Run in dry mode.')
  .option('--npm', 'Use npm as the package manager', false)
  .option('--pnpm', 'Use pnpm as the package manager', true)
  .option('--trusted', 'Use npm Trusted Publishing', true)
  .option('--monorepo', 'Configure a monorepo', false)
  .option('--fixed', 'Use fixed versioning for the monorepo', false)
  .option('--github-workflow', 'Create a GitHub Actions release workflow', true)
  .option('--force', 'Overwrite existing configuration or workflow files', false)
  .option('--add', 'Stage generated files with Git', true)
  .action(runInitCli)


program.parse(process.argv)
