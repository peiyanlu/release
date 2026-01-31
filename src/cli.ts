import { type CliOptions, readJsonFile } from '@peiyanlu/cli-utils'
import { green, red, yellow } from 'ansis'
import { Command, program } from 'commander'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'path'
import { Action } from './action.js'


const pkg = readJsonFile(join(__dirname, '..', 'package.json'))

function withCommonOptions(cmd: typeof program) {
  return cmd
    .version(pkg.version, '-v, --version', 'Print the tool version and exit.')
    .usage('[release-type] [options]')
    .argument('[release-type]', 'Version bump type: patch | minor | major')
    .option('-n, --dry-run', 'Run in dry mode', false)
    .option('-p, --package <pkg>', 'Specify package name (CI only).', '')
    .option('--otp <code>', 'One-time password for npm publish.', '')
    .option('--ci', 'Enable CI mode.', false)
    .option('--show-changelog', 'Print changelog and exit.', false)
    .option('--show-release', 'Print release version and exit.', false)
    .helpOption('-h, --help', 'Display help information.')
}

withCommonOptions(
  program
    .name('release')
    .description(pkg.description)
).action(async (releaseType: string, options: CliOptions) => {
  await new Action().handleRelease(releaseType, options)
})

withCommonOptions(
  program
    .command('prepare')
    .description('Prepare a release (bump version, commit, tag)')
)
  .action(async (releaseType, options) => {
    await new Action().handlePrepareRelease(releaseType, options)
  })


program
  .command('init')
  .description('Create a release configuration file')
  .option('-f, --force', 'Overwrite existing config file', false)
  .option('-m, --monorepo', 'Mono-repo project', false)
  .action((options: CliOptions<boolean>) => {
    const { force = false, monorepo = false } = options
    
    const cwd = process.cwd()
    
    const { type } = readJsonFile(join(cwd, 'package.json'))
    
    const isESM = type === 'module'
    const isTS = existsSync(join(cwd, 'tsconfig.json'))
    
    const configPath = join(cwd, `release.config.${ isESM ? '' : 'm' }${ isTS ? 'ts' : 'js' }`)
    
    if (existsSync(configPath) && !force) {
      console.error(
        `${ red`Error:` } ${ yellow`release.config.ts` } already exists.\n` +
        `Use ${ green`--force` } to overwrite.`,
      )
      process.exit(1)
    }
    
    const monoConfigToString = (): string => `{
  isMonorepo: true,
  packages: [ 'demo-a', 'demo-b' ],
  getPkgDir: (pkg) => \`packages/\${ pkg }\`,
  toTag: (pkg, version) => \`\${ pkg }@\${ version }\`,
  tagPrefix: (pkg) => \`\${ pkg }@\`,
}`
    
    const template = `import { defineConfig } from '@peiyanlu/release'

export default defineConfig(${ monorepo ? monoConfigToString() : '{}' })`
    
    writeFileSync(configPath, template, 'utf-8')
    
    console.log(`${ green`✔ release.config.ts` } created successfully`)
  })


program.parse(process.argv)


program.on('command:*', () => {
  console.error(`\n${ red`Error` } Invalid command: ${ red`%s` }`, program.args.join(' '))
  console.log(`See ${ red`--help` } for a list of available commands.\n`)
  process.exit(1)
})
