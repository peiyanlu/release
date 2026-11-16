import { cancel, isCancel } from '@clack/prompts'
import type { MaybePromise } from '@peiyanlu/ts-utils'
import { green, red, yellow } from 'ansis'


export const abortTask: (msg?: string) => never = (msg?: string): never => {
  cancel(`${ red('✕') } ${ msg ?? 'Task cancelled.' }`)
  process.exit(0)
}

export const singlePrompt = async <T>(fn: () => MaybePromise<T>, abortMsg?: string): Promise<Exclude<T, symbol>> => {
  const value = await fn()
  
  if (isCancel(value)) {
    abortTask(abortMsg)
  }
  
  return value as Exclude<T, symbol>
}

export const question = (msg: string, dryRun?: boolean): string => {
  const color = dryRun ? yellow : green
  return `${ color('?') } ${ msg }`
}
