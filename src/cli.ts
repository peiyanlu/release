import { type CliOptions, eol, gitAddSync, readJsonFile } from '@peiyanlu/cli-utils'
import { dim, green, red, underline, yellow } from 'ansis'
import { program } from 'commander'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'path'
import { Action } from './action.js'


const pkg = readJsonFile(join(__dirname, '..', 'package.json'))


program
  .name('release')
  .description(pkg.description)
  .version(pkg.version, '-v, --version', 'Print the tool version and exit.')
  .usage('[release-type] [options]')
  .argument('[release-type]', 'Version bump type: patch | minor | major')
  .option('-n, --dry-run', 'Run in dry mode', false)
  .option('-p, --package <pkg>', 'Specify package name (Mono-repo CI only).', '')
  .option('--otp <code>', 'One-time password for npm publish.', '')
  .option('--prepare', 'Prepare a release.', false)
  .option('--ci', 'Enable CI mode.', false)
  .option('--show-changelog', 'Print changelog and exit.', false)
  .option('--show-release', 'Print release version and exit.', false)
  .option(
    '-r, --release-count <count>',
    'Release count for release.',
    value => Number(value),
    1,
  )
  .option('-C, --no-require-clean-working-tree', 'Allow releasing with uncommitted changes.', true)
  .option('-m, --is-monorepo', 'Mono-repo project', false)
  .option('--skip-git', 'Skip all Git-related checks and operations.', false)
  .option('--skip-npm', 'Skip all npm-related checks and operations.', false)
  .option('--skip-github', 'Skip all GitHub-related checks and operations.', false)
  .helpOption('-h, --help', 'Display help information.')
  .action(async (releaseType: string, options: CliOptions) => {
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
  .action((options: CliOptions<boolean>) => {
    const { force = false, monorepo = false, add = false } = options
    
    const cwd = process.cwd()
    
    const { type } = readJsonFile(join(cwd, 'package.json'))
    
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
    
    const monoConfigToString = (): string => `{
  isMonorepo: true,
  packages: [ 'demo-a', 'demo-b' ],
  getPkgDir: (pkg) => \`packages/\${ pkg }\`,
  toTag: (pkg, version) => \`\${ pkg }@\${ version }\`,
  changelog: {
    tagPrefix: (pkg) => \`\${ pkg }@\`,
  },
}`
    
    const content = [
      `import { defineConfig } from '@peiyanlu/release'`,
      `export default defineConfig(${ monorepo ? monoConfigToString() : '{}' })`,
    ].join(eol(2))
    writeFileSync(configFile, content, 'utf-8')
    console.log(`Wrote to ${ underline(dim(configFile)) }`)
    
    if (add) gitAddSync([ infile ])
    
    console.log(`\n${ content }`)
  })

program.addHelpText('afterAll', '\nThanks for using!')

program.parse(process.argv)


program.on('command:*', () => {
  console.error(`\n${ red`Error` } Invalid command: ${ red`%s` }`, program.args.join(' '))
  console.log(`See ${ red`--help` } for a list of available commands.\n`)
  process.exit(1)
})
