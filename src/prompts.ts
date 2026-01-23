import { cancel, isCancel, log, outro } from '@clack/prompts'
import { red } from 'ansis'
import { MSG } from './messages.js'
import { ReleaseContext } from './types.js'
import { gitRollback } from './utils.js'


export const abortTask = (msg?: string) => {
  cancel(`${ red('✕') } ${ msg }`)
  process.exit(0)
}

export const abortSinglePrompt = (value: unknown) => {
  if (isCancel(value)) {
    abortTask(MSG.ABORT.CANCEL)
  }
}

export const abortGroupPrompt = (ctx?: ReleaseContext) => {
  ctx && gitRollback(ctx)
  abortTask(MSG.ABORT.CANCEL)
}

export const abortOnError = (err: Error, ctx?: ReleaseContext) => {
  ctx && gitRollback(ctx)
  const msg = err.message.replace(/^\[(github|npm|git)]/, a => red(a))
  log.message(`\n${ msg }\n`)
  process.exit(1)
}

export const taskEnd = (msg?: string) => {
  outro(msg)
  process.exit(0)
}
