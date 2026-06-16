import { confirm, group } from '@clack/prompts'
import { isUndefined } from '@peiyanlu/ts-utils'
import { yellow } from 'ansis'
import { MSG } from '../messages.js'
import { ReleaseContext, ResolvedConfig } from '../types.js'
import { abortGroupPrompt, msg, question } from '../utils.js'


export const runGitPrompts = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { git: { currentTag, commitMessage }, configFileExists: cfe, dryRun } = ctx
  const { git: { commit, tag, push } } = config
  const logs: string[] = []
  
  const shouldPrompt = (val: unknown) => isUndefined(val) || dryRun
  
  const res = await group(
    {
      commit: () => {
        return shouldPrompt(commit)
          ? confirm({ message: question(MSG.PROMPT.GIT_COMMIT(commitMessage), 'git') })
          : (() => {
            logs.push(yellow`git.commit`)
            return Promise.resolve(commit)
          })()
      },
      tag: ({ results: { commit } }) => {
        return shouldPrompt(tag)
          ? commit
            ? confirm({ message: question(MSG.PROMPT.GIT_TAG(currentTag), 'git') })
            : (() => {
              return Promise.resolve(false)
            })()
          : (() => {
            logs.push(yellow`git.tag`)
            return Promise.resolve(tag)
          })()
      },
      push: ({ results: { commit, tag } }) => {
        return shouldPrompt(push)
          ? (commit || tag)
            ? confirm({ message: question(MSG.PROMPT.GIT_PUSH, 'git') })
            : (() => {
              return Promise.resolve(false)
            })()
          : (() => {
            logs.push(yellow`git.push`)
            return Promise.resolve(push)
          })()
      },
      log: () => {
        if (logs.length) {
          msg('GIT', `Using ${ cfe ? 'user' : 'default' } config: ${ logs.join(', ') }`)
        }
        return Promise.resolve()
      },
    },
    {
      onCancel: ({ results }) => {
        abortGroupPrompt(ctx)
      },
    },
  )
  const { log: _, ...reset } = res
  
  Object.assign(config.git, reset)
}
