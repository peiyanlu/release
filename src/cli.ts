import { type CliOptions, readJsonFile } from '@peiyanlu/cli-utils'
import { red } from 'ansis'
import { program } from 'commander'
import { join } from 'path'
import { Action } from './action.js'


const pkg = readJsonFile(join(__dirname, '..', 'package.json'))

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version, '-v, --version', 'Output the current version.')
  .usage('[ARGUMENT] [OPTION]...')
  .argument('[argument]', 'patch|minor|major')
  .option('-n, --dry-run', 'Report actions that would be performed without writing out results.', false)
  .option('--ci', 'CI mode', false)
  .option('--otp', 'npm publish otp', '')
  .option('--show-changelog', 'Skip npm publish', false)
  .option('--show-release', 'Skip github release', false)
  .action(async (argName: string, options: CliOptions) => {
    await new Action().handle(argName, options)
  })
  .helpOption('-h, --help', 'Output usage information.')
  .parse(process.argv)


program.on('command:*', () => {
  console.error(`\n${ red`Error` } Invalid command: ${ red`%s` }`, program.args.join(' '))
  console.log(`See ${ red`--help` } for a list of available commands.\n`)
  process.exit(1)
})
