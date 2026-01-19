import { confirm, group } from '@clack/prompts'
import { isUndefined } from '@peiyanlu/ts-utils'
import { yellow } from 'ansis'
import { MSG } from '../messages.js'
import { abortGroupPrompt } from '../prompts.js'
import { ReleaseContext, ResolvedConfig } from '../types.js'
import { msg, question } from '../utils.js'


export const runGithubPrompts = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { configFileExists: cfe, dryRun, github: { releaseName } } = ctx
  const { github: { release } } = config
  const logs: string[] = []
  
  const shouldPrompt = (val: unknown) => isUndefined(val) || dryRun
  
  const res = await group(
    {
      release: () =>
        shouldPrompt(release)
          ? confirm({
            message: question(MSG.PROMPT.GITHUB_RELEASE(releaseName), 'github'),
          })
          : (() => {
            logs.push(yellow`github.release`)
            return Promise.resolve(release)
          })()
      ,
      log: () => {
        if (logs.length) {
          msg('GITHUB', `Using ${ cfe ? 'user' : 'default' } config: ${ logs.join(', ') }`)
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
  
  Object.assign(config.github, { release: res.release })
  
  return res
}

