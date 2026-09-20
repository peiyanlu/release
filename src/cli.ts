import { type CliOptions } from '@peiyanlu/cli-utils'
import { program } from 'commander'
import type { ReleaseType } from 'semver'
import pkgJson from '../package.json' with { type: 'json' }
import { loadConfig, type UserConfig } from './config/index.js'
import { GithubHosting } from './hosting-github/index.js'
import { PnpmProject, PnpmWorkspacesProject } from './project-pnpm/index.js'
import { ReleaserCli } from './releaser-cli/index.js'


program
  .name('release')
  .description(pkgJson.description)
  .version(pkgJson.version, '-v, --version', 'Print the tool version and exit.')
  .usage('[release-type] [options]')
  .argument('[release-type]', `Release type. One of 'major', 'minor', 'patch', or 'prerelease'.`)
  .enablePositionalOptions()
  .option('-n, --dry-run', 'Run in dry mode')
  .option('--ci', 'Enable CI mode.')
  .option('-r, --release-count <count>', 'Release count for release.', val => Number(val))
  .option('--skip-git', 'Skip all Git-related checks and operations.')
  .option('--skip-publish', 'Skip the package publishing step.')
  .option('--skip-release', 'Skip the repository release step.')
  .option('-m, --monorepo', 'Mono-repo project')
  .helpOption('-h, --help', 'Display help information.')
  .action(async (releaseType: ReleaseType, options: CliOptions<boolean>) => {
    const { config: { project, hosting, releaser } } = await loadConfig<UserConfig>(process.cwd())
    const { monorepo, dryRun } = options
    
    await new ReleaserCli({
      ...releaser,
      project: project
        ? project
        : monorepo
          ? new PnpmWorkspacesProject({
            mode: 'fixed',
          })
          : new PnpmProject(),
      ...(hosting ? { hosting: hosting as GithubHosting } : {}),
      dryRun,
    })
      .runAction({ releaseType, ...options })
  })


program.parse(process.argv)
