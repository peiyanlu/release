import type {
  AnyObject,
  CommitNote,
  FinalTemplateContext,
  TemplateContext,
  TransformedCommit,
} from '@conventional-changelog/template'
import {
  bold,
  compareUrl,
  each,
  heading,
  link,
  list,
  newline,
  segments,
  small,
  words,
} from '@conventional-changelog/template'
import { isEmpty, space } from '@peiyanlu/ts-utils'


export interface ExtraTemplateContext extends TemplateContext {
  /** 该项目在没有更改的情况下被升级，以与其他项目中的重大更改保持同步 */
  breakingSync?: boolean
}


const isLikelyHash = (value: string) => /^[0-9a-f]{7,40}$/i.test(value)

const indent = (text: string, n: number = 1, format?: (line: string) => string) => {
  return text
    .split(/\r?\n/)
    .map(line => format ? format(line) : `${ space(n) }${ line }`)
    .join('\n')
}


export function headerPartial(context: FinalTemplateContext): string {
  const { isPatch, linkCompare, version, title, date, previousTag } = context
  
  const versionText = (linkCompare && !isLikelyHash(previousTag!))
    ? link(version!, compareUrl(context))
    : version
  const fullTitle = words(versionText, title && `"${ title }"`, date && `(${ date })`)
  
  return heading(2, isPatch ? small(fullTitle) : fullTitle)
}

export function preamblePartial(contest: FinalTemplateContext & ExtraTemplateContext): string {
  const { preamble, commitGroups, noteGroups, breakingSync } = contest
  return segments(
    preamble,
    isEmpty(preamble) && isEmpty(commitGroups) && isEmpty(noteGroups) && (
      breakingSync
        ? 'Version bump to keep in sync with breaking changes in other packages.'
        : 'Version bump without any changes.'
    ),
  )
}

export function template(context: FinalTemplateContext): string {
  const {
    headerPartial,
    preamblePartial,
    commitPartial,
    footerPartial,
    noteGroups,
    commitGroups,
  } = context
  
  return segments(
    headerPartial(context),
    preamblePartial(context),
    each(
      noteGroups,
      group => segments(
        heading(3, words('⚠', group.title)),
        list(
          group.notes,
          (note: CommitNote & TransformedCommit<AnyObject>) => {
            const line1 = words(
              note.commit.scope && bold(`${ note.commit.scope }:`),
              commitPartial(context, note.commit),
            )
            
            const listReg = /^(?:[ \t]*)?([-*+]|\d{1,9}[.)])([ \t]{1,4})\S+/
            const text = note.commit.subject.trim() !== note.text.trim()
              ? note.text.match(listReg)
                ? note.text
                : list([ note.text ], t => t)
              : ''
            const body: string = note.commit.body
              ? note.commit.body.match(listReg)
                ? note.commit.body
                : list([ note.commit.body ], t => t)
              : ''
            
            const line2 = text
              ? [ text, indent(body, 2) ].join('\n')
              : body
            
            return each([ line1, line2 ], t => t, newline())
          },
        ),
      ),
      newline(2),
    ),
    each(
      commitGroups,
      group => segments(
        group.title && heading(3, group.title),
        list(
          group.commits,
          commit => commitPartial(context, commit),
        ),
      ),
      newline(2),
    ),
    footerPartial(context),
  )
}
