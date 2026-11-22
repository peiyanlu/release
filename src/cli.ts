import { readJsonFileSync } from '@peiyanlu/node-utils'
import { joinWithLine, tryCall, tryCallSync } from '@peiyanlu/ts-utils'
import { program } from 'commander'
import { join } from 'node:path'
import { runCommitCli, runDefaultCli, runInitCli } from './cli/index.ts'


const pkgJson = readJsonFileSync(join(__dirname, '..', 'package.json'))

program
  .name('release')
  .description(pkgJson.description)
  .version(pkgJson.version, '-v, --version', 'Print the tool version and exit')
  .usage('[release-type] [options] [--config.<path> <value>]')
  .argument(
    '[release-type]',
    joinWithLine([
      `SemVer release type, override 'config.bump.as';`,
      `When '--pre-id' is set, the release is a pre-release (for example, 'patch' becomes 'prepatch');`,
      `Examples: 'major', 'premajor', 'minor', 'preminor', 'patch', 'prepatch', 'release' or 'prerelease'.`,
    ]),
  )
  .enablePositionalOptions()
  .option('-n, --dry-run', 'Run in dry mode')
  .option(
    '--pre-id <preId>',
    joinWithLine([
      `Pre-release identifier, override 'config.bump.prerelease';`,
      `Examples: 'alpha', 'beta', 'rc', 'next', 'canary', 'nightly' or 'dev'.`,
    ]),
  )
  .option('--ci', 'Enable CI mode')
  .option('--skip-bump', 'Skip updating the project version')
  .option('--skip-git', 'Skip Git commit, tag, and push operations. Git history is still read')
  .option('--skip-working-tree-check', 'Skip checking whether the Git working tree is clean')
  .option('--skip-publish', 'Skip publishing the project')
  .option('--skip-release', 'Skip creating a release on the repository hosting service')
  .helpOption('-h, --help', 'Display help information')
  .action(runDefaultCli)

program
  .command('commit')
  .description('Create a Conventional Commit from staged changes')
  .option('-n, --dry-run', 'Run in dry mode')
  .option('--amend', 'Amend the previous commit with the entered message')
  .action(runCommitCli)

program
  .command('init')
  .description('Initialize release configuration for your project')
  .option('-n, --dry-run', 'Run in dry mode')
  .option('--npm', 'Use npm as the package manager', false)
  .option('--pnpm', 'Use pnpm as the package manager', true)
  .option('--trusted', 'Use npm Trusted Publishing', true)
  .option('--monorepo', 'Configure a monorepo', false)
  .option('--fixed', 'Use fixed versioning for the monorepo', false)
  .option('--github-workflow', 'Create a GitHub Actions release workflow', true)
  .option('--force', 'Overwrite existing configuration or workflow files', false)
  .option('--add', 'Stage generated files with Git', true)
  .action(runInitCli)


const tryParse = (value: string) => tryCall(() => JSON.parse(value), value)
const tryParseSync = (value: string) => tryCallSync(() => JSON.parse(value), value)


export const dynamicRegisterOptions = (argv: string[] = process.argv): void => {
  const names = new Set<string>()
  const prefix = '--config.'
  
  for (const arg of argv) {
    if (arg.startsWith(prefix)) {
      names.add(arg.split('=', 1)[0])
    }
  }
  
  for (const name of names) {
    const path = name.slice(prefix.length)
    program.option(`${ name } <value>`, `Override config value at '${ path }'`, tryParseSync)
  }
}

dynamicRegisterOptions(process.argv)


program.parse(process.argv)
