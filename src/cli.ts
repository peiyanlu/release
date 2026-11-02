import { cancel, confirm, intro, isCancel, outro, select } from '@clack/prompts'
import { newline } from '@conventional-changelog/template'
import { type CliOptions, gitAddSync, gitConfigGet, isGitRepo, isWorkingTreeClean } from '@peiyanlu/cli-utils'
import { readJsonFileSync } from '@peiyanlu/node-utils'
import { assert, throwError } from '@peiyanlu/ts-utils'
import { dim } from 'ansis'
import { Command, program } from 'commander'
import Handlebars from 'handlebars'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
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
  .option('--pnpm', 'Use pnpm as the package manager', true)
  .option('--trusted', 'Use npm Trusted Publishing', true)
  .option('--monorepo', 'Configure a monorepo', false)
  .option('--fixed', 'Use fixed versioning for the monorepo', false)
  .option('--github-workflow', 'Create a GitHub Actions release workflow', true)
  .option('--force', 'Overwrite existing configuration or workflow files', false)
  .option('--add', 'Stage generated files with Git', true)
  .action(async (options: CliOptions<boolean>, command: Command) => {
    const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY)
    
    const wasProvided = (name: string): boolean => 'cli' === command.getOptionValueSource(name)
    
    const ask = async <T>(
      name: string,
      prompt: () => Promise<T>,
      value: T,
      provided = wasProvided(name),
    ): Promise<T> => {
      if (!interactive || provided) return value
      const answer = await prompt()
      if (isCancel(answer)) {
        cancel('Initialization cancelled.')
        process.exit(0)
      }
      return answer as T
    }
    
    const cwd = process.cwd()
    const tplDir = resolve(__dirname, '..', 'template')
    
    const detectedPackageManager = existsSync(join(cwd, 'pnpm-lock.yaml'))
      ? 'pnpm'
      : existsSync(join(cwd, 'package-lock.json'))
        ? 'npm'
        : 'none'
    const defaultPackageManager = options.npm
      ? 'npm'
      : options.pnpm
        ? 'pnpm'
        : detectedPackageManager
    
    if (interactive) intro('🚀 Initialize release config')
    
    const packageManager = await ask(
      'npm',
      () => select({
        message: 'Package manager?',
        options: [
          { label: 'npm', value: 'npm' },
          { label: 'pnpm', value: 'pnpm' },
          { label: 'None', value: 'none' },
        ],
        initialValue: defaultPackageManager,
      }) as Promise<'npm' | 'pnpm' | 'none'>,
      defaultPackageManager,
      wasProvided('npm') || wasProvided('pnpm'),
    )
    const npm = packageManager === 'npm'
    const pnpm = packageManager === 'pnpm'
    
    const monorepo = await ask('monorepo', () => confirm({
      message: 'Monorepo?',
      initialValue: options.monorepo,
    }) as Promise<boolean>, options.monorepo)
    const fixed = monorepo
      ? await ask('fixed', () => confirm({
        message: 'Fixed versioning?',
        initialValue: options.fixed,
      }) as Promise<boolean>, options.fixed)
      : false
    const githubWorkflow = await ask('githubWorkflow', () => confirm({
      message: 'GitHub Actions workflow?',
      initialValue: options.githubWorkflow,
    }) as Promise<boolean>, options.githubWorkflow)
    const trusted = githubWorkflow
      ? await ask('trusted', () => confirm({
        message: 'npm Trusted Publishing?',
        initialValue: options.trusted,
      }) as Promise<boolean>, options.trusted)
      : false
    const add = await ask('add', () => confirm({
      message: 'Stage files with Git?',
      initialValue: options.add,
    }) as Promise<boolean>, options.add)
    
    const pkg = readJsonFileSync(join(cwd, 'package.json'))
    const isTS = existsSync(join(cwd, 'tsconfig.json')) || Object
      .keys({
        ...pkg.dependencies,
        ...pkg.devDependencies,
      }).includes('typescript')
    
    const configFile = join(cwd, `release.config.${ isTS ? 'ts' : 'js' }`)
    const workflowFile = join(cwd, '.github/workflows', 'release.yml')
    
    const existingFiles = [
      ...(existsSync(configFile) ? [ configFile ] : []),
      ...(githubWorkflow && existsSync(workflowFile) ? [ workflowFile ] : []),
    ]
    
    let force = options.force
    if (existingFiles.length && !force) {
      const files = existingFiles.map(p => relative(cwd, p)).join(' | ')
      force = await ask('force', () => confirm({
        message: `Overwrite files? ${ dim(files) }`,
        initialValue: false,
      }) as Promise<boolean>, false)
      if (!force) throwError(`Existing files: ${ files }`)
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
      await mkdir('.github/workflows', { recursive: true })
      const template = readFileSync(join(tplDir, `release.workflow.hbs`), 'utf-8')
      const workflowContent = Handlebars.compile(template)({
        trusted,
      })
      writeFileSync(workflowFile, workflowContent.trimEnd() + newline(), 'utf-8')
    }
    
    if (add) {
      gitAddSync(githubWorkflow ? [ configFile, workflowFile ] : [ configFile ])
    }
    
    if (interactive) outro('✨ Release config ready')
  })


program.parse(process.argv)
