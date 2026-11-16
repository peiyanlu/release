import { confirm, intro, log, multiline, note, outro, select, text } from '@clack/prompts'
import type { CliOptions } from '@peiyanlu/cli-utils'
import { gitAddTracked, gitCommitAmend, gitCommitMessage, gitDiff, gitLog } from '@peiyanlu/git-utils'
import { isInDir, normalizePath } from '@peiyanlu/node-utils'
import { assert, isEmptyArray, type Primitive, splitNonEmptyLines } from '@peiyanlu/ts-utils'
import { dim, red } from 'ansis'
import { dirname, resolve } from 'node:path'
import { type Project } from '../core/index.ts'
import { defaultTypes, loadConfig, type UserConfig } from '../index.ts'
import { abortTask, question, singlePrompt } from './prompts.ts'


interface ProjectScope {
  name: string
  scope: string
  directory: string
}


const abortMsg = 'Commit cancelled.'

const unique = <T = Primitive>(v: T[]) => [ ...new Set([ ...v ]) ]


const getDirectoryScopes = (cwd: string, projectDir: string, files: string[]): string[] => {
  return unique(files
    .filter(file => isInDir(projectDir, resolve(cwd, file)))
    .map(path => normalizePath(dirname(path)).split('/'))
    .filter(path => path.length > 1)
    .flatMap(parts => [ parts[1], parts[parts.length - 1] ]))
}

const getAffectedProjectScopes = async (
  cwd: string,
  project: Project,
  stagedFiles: string[],
): Promise<ProjectScope[]> => {
  const entries: ProjectScope[] = []
  
  if (!project.isMonorepoMode()) {
    const directory = resolve(cwd, project.manifest.projectDir)
    const scopes = getDirectoryScopes(cwd, directory, stagedFiles)
    
    if (scopes) {
      entries.push(
        ...scopes.map(scope => ({
          name: scope,
          scope,
          directory,
        })),
      )
    }
    
    return entries
  }
  
  for await (const subProject of project.getProjects()) {
    const name = await subProject.manifest.getName()
    entries.push({
      name,
      scope: await project.getScope(name),
      directory: resolve(cwd, subProject.manifest.projectDir),
    })
  }
  
  const affected = new Map<string, ProjectScope>()
  
  stagedFiles.map(file => {
    const entry = entries.find(e => isInDir(e.directory, resolve(cwd, file)))
    if (entry) affected.set(entry.name, entry)
  })
  
  return [ ...affected.values() ]
}

const promptScope = async (scopes: ProjectScope[], init: string | undefined, dryRun: boolean): Promise<string> => {
  if (isEmptyArray(scopes)) {
    return singlePrompt(
      () => text({
        message: question('Commit scope?', dryRun),
        placeholder: 'leave empty',
        initialValue: init,
      }),
      abortMsg,
    )
  }
  
  const customScope = '__CUSTOM_SCOPE__'
  const options = scopes.map(({ name, scope }) => ({
    label: name,
    hint: scope,
    value: scope,
  }))
  
  const allScopes = scopes.map(({ scope }) => scope).filter(Boolean).join(',')
  
  if (scopes.length > 1 && allScopes) {
    options.unshift({
      label: `All-Changed`,
      hint: allScopes,
      value: allScopes,
    })
  }
  
  options.push(
    {
      label: 'Custom',
      hint: '',
      value: customScope,
    },
    {
      label: 'No-Scope',
      hint: '',
      value: '',
    },
  )
  
  const initialValue = init ?? scopes.length === 1 ? scopes[0].scope : allScopes
  const selection = await singlePrompt(
    () => select({
      message: question('Commit scope?', dryRun),
      options,
      initialValue,
    }),
    abortMsg,
  )
  
  if (selection === customScope) {
    return singlePrompt(
      () => text({
        message: question('Custom scope?', dryRun),
        placeholder: 'leave empty',
      }),
      abortMsg,
    )
  }
  
  return selection
}

const printer = (msg: string) => log.message(dim`${ msg }`)


export const runCommitCli = async (options: CliOptions<boolean>): Promise<void> => {
  const { amend = false, dryRun = false } = options
  
  const interactive = process.stdin.isTTY && process.stdout.isTTY
  assert(interactive, 'The commit command requires an interactive terminal.')
  
  intro('🚀 Commit staged changes')
  
  !dryRun && await gitAddTracked()
  const files = splitNonEmptyLines(await gitDiff([ '--cached', '--name-only' ]))
  assert(amend || files.length, 'No staged changes to commit.')
  
  printer('Files to commit:')
  for (const file of files) {
    printer(`- ${ file }`)
  }
  
  const cwd = process.cwd()
  const { config } = await loadConfig<UserConfig>(cwd)
  const projectScopes = config.project
    ? await getAffectedProjectScopes(cwd, config.project, files)
    : []
  
  const msg = await gitLog([ '-1', '--pretty=%s' ])
  const [ _, oType, oScope, oSubject ] = msg.match(/^(\w+)(?:\(([^)]+)\))?:\s+(\S+)/) ?? []
  
  const type = await singlePrompt(
    () => select({
      message: question('Commit type?', dryRun),
      options: defaultTypes.map(({ type, section }) => ({
        label: type,
        value: type,
        hint: section,
      })),
      initialValue: amend ? oType : undefined,
    }),
    abortMsg,
  )
  
  const scope = await promptScope(projectScopes, amend ? oScope : undefined, dryRun)
  
  const subject = await singlePrompt(
    () => multiline({
      message: question('Commit description?', dryRun),
      showSubmit: true,
      initialValue: amend ? oSubject : undefined,
      validate: value => value?.trim() ? undefined : 'A commit description is required.',
    }),
    abortMsg,
  )
  
  const header = `${ type }${ scope.trim() ? `(${ scope.trim() })` : '' }: ${ subject.trim() }`
  note(header, 'Commit message')
  
  const shouldCommit = await singlePrompt(
    () => confirm({
      message: question(red`${ amend ? 'Amend previous commit' : 'Create this commit' }?`, dryRun),
    }),
    abortMsg,
  )
  if (!shouldCommit) abortTask(abortMsg)
  
  if (!dryRun) {
    if (amend) {
      await gitCommitAmend(header)
    } else {
      await gitCommitMessage(header)
    }
  }
  
  outro(`✨ Commit ${ amend ? 'amended' : 'complete' }`)
}
