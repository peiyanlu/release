import { isIndex, isString, isUndefined } from '@peiyanlu/ts-utils'


interface Comment {
  body?: string
  author_association: string
}

const ALLOWED_AUTHOR_ASSOCIATIONS = [
  'OWNER',
  'COLLABORATOR',
  'MEMBER',
]
const JSON_START = '```json'
const JSON_START_OFFSET = JSON_START.length
const JSON_END = '```'

export const SET_OPTION_COMMAND = '!release/set-options'
export const SET_PREAMBLE_COMMAND = '!release/set-preamble'

/** 所有支持的拉取请求评论命令 */
export const COMMANDS = [
  SET_OPTION_COMMAND,
  SET_PREAMBLE_COMMAND,
]

/**
 * 判断正文是否以命令开头，并且命令后紧跟空白字符或正文结束。
 * 这样可以避免将更长的标记（例如 `!release/set-options-foo`）误判为匹配的命令
 */
const startsWithCommand = (body: string, command: string) => {
  if (!body.startsWith(command)) {
    return false
  }
  
  const nextChar = body[command.length]
  return isUndefined(nextChar) || /\s/.test(nextChar)
}

/** 评论内容是否是支持的命令评论之一 */
export const isCommandComment = (body?: string) =>
  isString(body) && COMMANDS.some(command => startsWithCommand(body, command))

/** 解析 releaser 参数 */
export const parseSetOptionsComment = (comment: Comment): string | undefined => {
  if (ALLOWED_AUTHOR_ASSOCIATIONS.includes(comment.author_association)) {
    const { body } = comment
    
    if (body && startsWithCommand(body, SET_OPTION_COMMAND)) {
      const start = body.indexOf(JSON_START)
      // 在开头代码围栏之后遇到的第一个围栏处结束，避免评论后续的代码块扩展提取出的 JSON。
      const end = isIndex(start)
        ? body.indexOf(JSON_END, start + JSON_START_OFFSET)
        : -1
      
      // 必须是规范的 ```json ... ``` 代码块，否则没有可解析的内容。
      if (!isIndex(start) || !isIndex(end)) {
        return
      }
      
      return body.substring(start + JSON_START_OFFSET, end).trim()
    }
  }
}


export interface SetPreamble {
  /** 此前言所针对的完整包名；如果为 `undefined`，则作用于整个发布版本 */
  name?: string
  /** 要插入到更新日志前言中的 Markdown 内容 */
  preamble: string
}

/** 解析日志前言 */
export function parseSetPreambleComment(comment: Comment): SetPreamble | null {
  if (ALLOWED_AUTHOR_ASSOCIATIONS.includes(comment.author_association)) {
    const { body } = comment
    
    if (body && startsWithCommand(body, SET_PREAMBLE_COMMAND)) {
      const newlineIndex = body.indexOf('\n')
      
      const firstLine = isIndex(newlineIndex) ? body.slice(0, newlineIndex) : body
      const secondLine = isIndex(newlineIndex) ? body.slice(newlineIndex + 1).trim() : ''
      
      const name = firstLine
        .slice(SET_PREAMBLE_COMMAND.length)
        .replace(/`/g, '') // pkg-name 或 `@scope/pkg-name`
        .trim()
        .split(/\s+/)[0]
      const preamble = secondLine
      
      if (preamble) {
        return {
          name,
          preamble,
        }
      }
    }
  }
  
  return null
}
