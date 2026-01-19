import { confirm, group, text } from '@clack/prompts'
import { isUndefined } from '@peiyanlu/ts-utils'
import { yellow } from 'ansis'
import { MSG } from '../messages.js'
import { abortGroupPrompt } from '../prompts.js'
import { ReleaseContext, ResolvedConfig } from '../types.js'
import { msg, question } from '../utils.js'


export const runNpmPublishPrompts = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { pkg: { name, next }, configFileExists: cfe, dryRun } = ctx
  const { npm: { publish } } = config
  const logs: string[] = []
  
  const target = `${ name }@${ next }`
  
  const shouldPrompt = (val: unknown) => isUndefined(val) || dryRun
  
  const res = await group(
    {
      publish: () =>
        shouldPrompt(publish)
          ? confirm({
            message: question(MSG.PROMPT.NPM_PUBLISH(target), 'npm'),
          })
          : (() => {
            logs.push(yellow`npm.publish`)
            return Promise.resolve(publish)
          })()
      ,
      log: () => {
        if (logs.length) {
          msg('NPM', `Using ${ cfe ? 'user' : 'default' } config: ${ logs.join(', ') }`)
        }
        return Promise.resolve()
      },
    },
    {
      onCancel: async ({ results }) => {
        abortGroupPrompt(ctx)
      },
    },
  )
  
  Object.assign(config.npm, { publish: res.publish })
  
  return res
}

export const runNpmOptPrompts = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const res = await group(
    {
      otp: () => text({
        message: MSG.PROMPT.NPM_OTP,
      }),
    },
    {
      onCancel: ({ results }) => {
        abortGroupPrompt(ctx)
      },
    },
  )
  
  Object.assign(ctx.npm, { otp: res.otp })
  
  return res
}
