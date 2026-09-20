import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { GitRepositoryHosting, Project, ReleaserOptions, ReleaserStepsOptions } from '../core/index.js'


export interface UserConfig<
  P extends Project = Project,
  G extends GitRepositoryHosting = GitRepositoryHosting
> extends ReleaserStepsOptions<P, G> {
  project?: P
  hosting?: G
  releaser?: Omit<ReleaserOptions, 'project' | 'hosting'>
}

export const defineConfig = <
  P extends Project = Project,
  G extends GitRepositoryHosting = GitRepositoryHosting
>(config: UserConfig<P, G>): UserConfig<P, G> => config


export const loadJavaScriptFile = async <T extends object>(file: string): Promise<T> => {
  const { href } = pathToFileURL(file)
  const mod = await import(href) as T | { default: T } | (() => T)
  const temp = 'default' in mod ? mod.default : mod
  return typeof temp === 'function' ? temp() : temp
}

export const findFile = (cwd: string, filename: string, extensions: string[]): string | undefined => {
  for (const ext of extensions) {
    const path = resolve(cwd, `${ filename }.${ ext }`)
    if (existsSync(path)) {
      return path
    }
  }
}

export const loadConfig = async <T extends object>(cwd: string = process.cwd()): Promise<{
  file: string;
  config: T;
}> => {
  const file = findFile(cwd, 'release.config', [ 'ts', 'mts', 'js', 'mjs' ])
  
  if (!file) {
    return { file: '', config: {} as T }
  }
  
  const config = await loadJavaScriptFile<T>(file)
  
  return { file, config }
}
