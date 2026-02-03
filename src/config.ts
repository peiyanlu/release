import { DeepPartial, DeepRequired, isFunction, isPlainObject } from '@peiyanlu/ts-utils'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ReleaseConfig } from './types.js'


export type UserConfig = DeepPartial<ReleaseConfig>

export type UserConfigFnObject = () => UserConfig
export type UserConfigFnPromise = () => Promise<UserConfig>
export type UserConfigFn = () => UserConfig | Promise<UserConfig>

export type UserConfigExport =
  | UserConfig
  | Promise<UserConfig>
  | UserConfigFnObject
  | UserConfigFnPromise
  | UserConfigFn


export function defineConfig(config: UserConfig): UserConfig
export function defineConfig(config: Promise<UserConfig>): Promise<UserConfig>
export function defineConfig(config: UserConfigFnObject): UserConfigFnObject
export function defineConfig(config: UserConfigFnPromise): UserConfigFnPromise
export function defineConfig(config: UserConfigFn): UserConfigFn
export function defineConfig(config: UserConfigExport): UserConfigExport
export function defineConfig(config: UserConfigExport): UserConfigExport {
  return config
}

const findConfigFile = (cwd = process.cwd()) => {
  for (const ext of [ 'ts', 'mts', 'js', 'mjs' ]) {
    const path = resolve(cwd, `release.config.${ ext }`)
    if (existsSync(path)) {
      return path
    }
  }
}

const loadConfig = async <T = unknown>(file: string): Promise<T> => {
  const { href } = pathToFileURL(file)
  const mod = await import(href)
  const temp = mod.default ?? mod
  return (typeof temp === 'function') ? temp() : temp
}

export const resolveConfig = async <T = unknown>(cwd?: string): Promise<{ configPath: string, config: T}> => {
  const configFile = findConfigFile(cwd)
  
  if (!configFile) return {
    configPath: '',
    config: {} as T
  }
  
  const config = await loadConfig<T>(configFile)
  return {
    configPath: configFile,
    config: config
  }
}

export const mergeConfig = <T extends object>(
  defaults: DeepRequired<T>,
  overrides?: DeepPartial<T>,
): DeepRequired<T> => {
  if (!overrides) return structuredClone(defaults)
  if (Object.keys(defaults).length === 0) return structuredClone(overrides) as DeepRequired<T>
  
  const result: any = {}
  
  for (const key in defaults) {
    const defaultValue = (defaults as any)[key]
    const overrideValue = (overrides as any)[key]
    
    if (overrideValue === undefined) {
      if (isFunction(defaultValue)) {
        result[key] = defaultValue
      } else {
        result[key] = structuredClone(defaultValue)
      }
    } else if (isPlainObject(defaultValue) && isPlainObject(overrideValue)) {
      result[key] = mergeConfig(defaultValue, overrideValue)
    } else {
      if (isFunction(overrideValue)) {
        result[key] = overrideValue
      } else {
        result[key] = structuredClone(overrideValue)
      }
    }
  }
  
  return result
}
