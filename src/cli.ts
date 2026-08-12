import { newline } from '@conventional-changelog/template'
import { type CliOptions, gitAddSync } from '@peiyanlu/cli-utils'
import { readJsonFileSync } from '@peiyanlu/node-utils'
import { dedent } from '@peiyanlu/ts-utils'
import { dim, green, red, underline, yellow } from 'ansis'
import { program } from 'commander'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'path'
import pkgJson from '../package.json' with { type: 'json' }
import { Action, type ReleaseCliOptions } from './action.js'
import { generateMonoConfig } from './monorepo/packages.js'


program
  .name('release')
  .description(pkgJson.description)
  .version(pkgJson.version, '-v, --version', 'Print the tool version and exit.')
  .usage('[release-type] [options]')
  .argument('[release-type]', 'Version bump type: patch | minor | major')
  .enablePositionalOptions()
  .option('-n, --dry-run', 'Run in dry mode', false)
  .option('-p, --package <pkg>', 'Specify package name (Mono-repo CI only).', '')
  .option('--otp <code>', 'One-time password for npm publish.', '')
  .option('--prepare', 'Prepare a release.', false)
  .option('--ci', 'Enable CI mode.', false)
  .option('--show-changelog', 'Print changelog and exit.', false)
  .option('--show-release', 'Print release version and exit.', false)
  .option('--only-changelog', 'Only update the changelog.', false)
  // config start
  .option('-r, --release-count <count>', 'Release count for release.', val => Number(val))
  .option('--include-hidden', 'Include hidden commit types in the changelog.')
  .option('-C, --no-require-clean-working-tree', 'Allow releasing with uncommitted changes.')
  .option('--skip-git', 'Skip all Git-related checks and operations.')
  .option('--skip-npm', 'Skip all npm-related checks and operations.')
  .option('--skip-github', 'Skip all GitHub-related checks and operations.')
  .option('-m, --is-monorepo', 'Mono-repo project')
  // config end
  .helpOption('-h, --help', 'Display help information.')
  .action(async (releaseType: string, options: ReleaseCliOptions) => {
    const { prepare } = options
    const action = new Action()
    prepare
      ? await action.handlePrepareRelease(releaseType, options)
      : await action.handleRelease(releaseType, options)
  })

program
  .command('init')
  .description('Create a release configuration file')
  .option('-f, --force', 'Overwrite existing config file', false)
  .option('-m, --monorepo', 'Mono-repo project', false)
  .option('-a, --add', 'Automatically stage the config file.', false)
  .action(async (options: CliOptions<boolean>) => {
    const { force = false, monorepo = false, add = false } = options
    
    const cwd = process.cwd()
    
    const { type } = readJsonFileSync(join(cwd, 'package.json'))
    
    const isESM = type === 'module'
    const isTS = existsSync(join(cwd, 'tsconfig.json'))
    
    const infile = `release.config.${ isESM ? '' : 'm' }${ isTS ? 'ts' : 'js' }`
    const configFile = join(cwd, infile)
    
    if (existsSync(configFile) && !force) {
      console.error(
        `${ red`Error:` } ${ yellow(infile) } already exists.\n` +
        `Use ${ green`--force` } to overwrite.`,
      )
      process.exit(1)
    }
    
    const config = () => dedent(`
      import { defineConfig } from '@peiyanlu/release'
      ${ newline(1) }
      export default defineConfig({})
    `)
    
    const content = monorepo ? generateMonoConfig(process.cwd()) : config()
    writeFileSync(configFile, content + newline(), 'utf-8')
    
    console.log(`Wrote to ${ underline(dim(configFile)) }`)
    
    if (add) gitAddSync([ infile ])
    
    console.log(`\n${ content }`)
  })

program.addHelpText('afterAll', '\nCASE: release -C -r0 --include-hidden --only-changelog\n\nThanks for using!')

program.parse(process.argv)


program.on('command:*', () => {
  console.error(`\n${ red`Error` } Invalid command: ${ red`%s` }`, program.args.join(' '))
  console.log(`See ${ red`--help` } for a list of available commands.\n`)
  process.exit(1)
})
