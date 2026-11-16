import { confirm, intro, outro, select } from '@clack/prompts'
import type { CliOptions } from '@peiyanlu/cli-utils'
import { gitAdd } from '@peiyanlu/git-utils'
import { readJsonFileSync, readTextFile, writeTextFile } from '@peiyanlu/node-utils'
import { assert } from '@peiyanlu/ts-utils'
import { dim } from 'ansis'
import { Command } from 'commander'
import Handlebars from 'handlebars'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { question, singlePrompt } from './prompts.js'


const isNpm = (v: string) => 'npm' === v
const isPnpm = (v: string) => 'pnpm' === v
const isYarn = (v: string) => 'yarn' === v


export const runInitCli = async (options: CliOptions<boolean>, command: Command) => {
  const { dryRun = false } = options
  
  const interactive = process.stdin.isTTY && process.stdout.isTTY
  assert(interactive, 'The commit command requires an interactive terminal.')
  
  intro('🚀 Initialize release config')
  
  const wasProvided = (name: string): boolean => 'cli' === command.getOptionValueSource(name)
  
  const ask = async <T>(
    name: string,
    prompt: () => Promise<T>,
    value: Exclude<T, symbol>,
    provided = wasProvided(name),
  ): Promise<Exclude<T, symbol>> => {
    if (provided) return value
    
    return singlePrompt(prompt, 'Initialization cancelled.')
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
  
  const packageManager = await ask(
    'packageManager',
    () => select({
      message: question('Package manager?', dryRun),
      options: [ 'npm', 'pnpm', 'none' ].map(k => ({ label: k, value: k })),
      initialValue: defaultPackageManager,
    }),
    defaultPackageManager,
    wasProvided('npm') || wasProvided('pnpm'),
  )
  const npm = isNpm(packageManager)
  const pnpm = isPnpm(packageManager)
  
  const monorepo = await ask(
    'monorepo',
    () => confirm({
      message: question('Monorepo?', dryRun),
      initialValue: options.monorepo,
    }),
    options.monorepo,
  )
  
  const fixed = monorepo
    ? await ask(
      'fixed',
      () => confirm({
        message: question('Fixed versioning?', dryRun),
        initialValue: options.fixed,
      }),
      options.fixed,
    )
    : false
  
  const githubWorkflow = await ask(
    'githubWorkflow',
    () => confirm({
      message: question('GitHub Actions workflow?', dryRun),
      initialValue: options.githubWorkflow,
    }),
    options.githubWorkflow,
  )
  
  const trusted = githubWorkflow
    ? await ask(
      'trusted',
      () => confirm({
        message: question('npm Trusted Publishing?', dryRun),
        initialValue: options.trusted,
      }),
      options.trusted,
    )
    : false
  
  const add = await ask(
    'add',
    () => confirm({
      message: question('Stage files with Git?', dryRun),
      initialValue: options.add,
    }),
    options.add,
  )
  
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
    force = await ask(
      'force',
      () => confirm({
        message: question(`Overwrite files? ${ dim(files) }`, dryRun),
        initialValue: options.force,
      }),
      options.force,
    )
    assert(force, `The following files already exist (${ files }).`)
  }
  
  if (!dryRun) {
    const template = await readTextFile(join(tplDir, `release.config.hbs`))
    const configContent = Handlebars.compile(template)({
      monorepo,
      fixed,
      npm,
      pnpm,
      npmOrPnpm: npm || pnpm,
    })
    await writeTextFile(configFile, configContent.trimEnd())
  }
  
  if (githubWorkflow && !dryRun) {
    await mkdir('.github/workflows', { recursive: true })
    const template = await readTextFile(join(tplDir, `release.workflow.hbs`))
    const workflowContent = Handlebars.compile(template)({
      trusted,
    })
    await writeTextFile(workflowFile, workflowContent.trimEnd())
  }
  
  if (add && !dryRun) {
    await gitAdd(githubWorkflow ? [ configFile, workflowFile ] : [ configFile ])
  }
  
  outro('✨ Release config ready')
}
