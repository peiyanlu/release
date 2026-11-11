import { isString, tryCallSync } from '@peiyanlu/ts-utils'


type Input = string | string[] | Iterable<string> | AsyncIterable<string | Buffer>

interface LastRelease {
  version: string;
  notes: string;
  previousTag: string;
  nextTag: string;
}


const versionHeaderRegex = /^#+ (?:<small>)?\[?([^[\]()\s]*\d+\.\d+\.\d+[^[\]()\s]*)]?(?:<\/small>)?/m
const tagsRegex = /\/([^/)]*)\.\.\.([^/)]*)\)/

const decodeTag = (tag: string) => tryCallSync(() => decodeURIComponent(tag), tag)


export const extractLastRelease = async (input: Input): Promise<LastRelease> => {
  let stream = input
  let inLastChanges = false
  let notes = ''
  let chunk: Buffer | string
  let lines: string[]
  let line: string
  let previousTag = ''
  let nextTag = ''
  let version = ''
  
  if (isString(stream)) {
    stream = [ stream ]
  }
  
  top: for await (chunk of stream) {
    lines = chunk.toString('utf8').split(/\r?\n/)
    
    for (line of lines) {
      const versionMatch = line.match(versionHeaderRegex)
      
      if (versionMatch) {
        if (inLastChanges) {
          break top
        }
        
        [ , version ] = versionMatch
        inLastChanges = true
        
        const tagsMatch = line.match(tagsRegex)
        
        if (tagsMatch) {
          // 标签从比较链接中提取，可能经过 URL 编码。
          previousTag = decodeTag(tagsMatch[1])
          nextTag = decodeTag(tagsMatch[2])
        }
        
        continue
      }
      
      if (inLastChanges) {
        notes += `${ line }\n`
      }
    }
  }
  
  return {
    version,
    notes: notes.trim(),
    previousTag,
    nextTag,
  }
}
