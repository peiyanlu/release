import { cancel, isCancel, log, outro } from '@clack/prompts'
import { red } from 'ansis'
import { gitRollback } from './git/commit.js'
import { MSG } from './messages.js'
import { ReleaseContext } from './types.js'


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

export const abortOnError = (err: Error, ctx?: ReleaseContext, exit = true) => {
  ctx && gitRollback(ctx)
  const msg = err.message.replace(/^\[(github|npm|git)]/, a => red(a))
  log.message(`\n${ msg }\n`)
  exit && process.exit(1)
}

export const taskEnd = (msg?: string) => {
  outro(msg)
  process.exit(0)
}
