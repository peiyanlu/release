import { newline } from '@conventional-changelog/template'
import { type CliOptions, gitAddSync, gitConfigGet, isGitRepo, isWorkingTreeClean } from '@peiyanlu/cli-utils'
import { readJsonFileSync } from '@peiyanlu/node-utils'
import { assert, throwError } from '@peiyanlu/ts-utils'
import { program } from 'commander'
import Handlebars from 'handlebars'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { join } from 'path'
import type { ReleaseType } from 'semver'
import { loadConfig, ReleaserCli, type UserConfig } from './index.js'


const pkgJson = readJsonFileSync(join(__dirname, '..', 'package.json'))

program
  .name('release')
  .description(pkgJson.description)
  .version(pkgJson.version, '-v, --version', 'Print the tool version and exit.')
  .usage('[release-type] [options]')
  .argument('[release-type]', `Release type. One of 'major', 'minor', 'patch', or 'prerelease'.`)
  .enablePositionalOptions()
  .option('-n, --dry-run', 'Run in dry mode.')
  .option('--ci', 'Enable CI mode.')
  .option('--skip-bump', 'Skip updating the project version.')
  .option('--skip-git', 'Skip Git commit, tag, and push operations. Git history is still read.')
  .option('--skip-publish', 'Skip publishing the project.')
  .option('--skip-release', 'Skip creating a release on the repository hosting service.')
  .helpOption('-h, --help', 'Display help information.')
  .action(async (releaseType: ReleaseType, options: CliOptions<boolean>) => {
    const { config: { project, hosting, releaser } } = await loadConfig<UserConfig>(process.cwd())
    const { dryRun } = options
    
    assert(await isGitRepo(), 'Current directory is not a Git repository')
    assert(await isWorkingTreeClean(), 'Git working tree is not clean')
    assert(await gitConfigGet('remote.origin.url'), 'Git remote "origin" is not configured')
    
    assert(project, 'Project not found')
    assert(hosting, 'GitRepositoryHosting not found')
    
    await new ReleaserCli({
      ...releaser,
      project,
      hosting,
      dryRun,
    })
      .runAction({ releaseType, ...options })
  })

program
  .command('init')
  .description('Initialize release configuration for your project.')
  .option('--npm', 'Use npm as the package manager', false)
  .option('--pnpm', 'Use pnpm as the package manager', false)
  .option('--monorepo', 'Configure a monorepo', false)
  .option('--fixed', 'Use fixed versioning for the monorepo', false)
  .option('--github-workflow', 'Create a GitHub Actions release workflow', false)
  .option('--force', 'Overwrite existing configuration or workflow files', false)
  .option('--add', 'Stage generated files with Git', false)
  .action(async (options: CliOptions<boolean>) => {
    const { npm, pnpm, monorepo, fixed, githubWorkflow, force, add } = options
    
    const cwd = process.cwd()
    const tplDir = resolve(__dirname, '..', 'template')
    
    const { dependencies, devDependencies } = readJsonFileSync(join(cwd, 'package.json'))
    
    const isTS = existsSync(join(cwd, 'tsconfig.json')) || Object
      .keys({
        ...dependencies,
        ...devDependencies,
      }).includes('typescript')
    
    const configFile = join(cwd, `release.config.${ isTS ? 'ts' : 'js' }`)
    const workflowFile = join(cwd, '.github/workflows', 'release.yml')
    
    if (existsSync(configFile) && !force) {
      throwError(`"${ configFile }" already exists`)
    }
    
    if (githubWorkflow && existsSync(workflowFile) && !force) {
      throwError(`"${ workflowFile }" already exists`)
    }
    
    const template = readFileSync(join(tplDir, `release.config.hbs`), 'utf-8')
    const configContent = Handlebars.compile(template)({
      monorepo,
      fixed,
      npm,
      pnpm,
      npmOrPnpm: npm || pnpm,
    })
    writeFileSync(configFile, configContent.trimEnd() + newline(), 'utf-8')
    
    if (githubWorkflow) {
      const workflowContent = readFileSync(join(tplDir, `release.text`), 'utf-8')
      await mkdir('.github/workflows', { recursive: true })
      writeFileSync(workflowFile, workflowContent.trimEnd() + newline(), 'utf-8')
    }
    
    if (add) {
      gitAddSync(githubWorkflow ? [ configFile, workflowFile ] : [ configFile ])
    }
  })


program.parse(process.argv)
