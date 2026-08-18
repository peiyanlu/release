import type { AnyObject, CommitNote, FinalTemplateContext, TransformedCommit } from '@conventional-changelog/template'
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
import { isEmpty } from '@peiyanlu/ts-utils'


const isLikelyHash = (value: string) => /^[0-9a-f]{7,40}$/i.test(value)


export function headerPartial(context: FinalTemplateContext) {
  const { isPatch, linkCompare, version, title, date, previousTag } = context
  
  const versionText = (linkCompare && !isLikelyHash(previousTag!))
    ? link(version!, compareUrl(context))
    : version
  const fullTitle = words(versionText, title && `"${ title }"`, date && `(${ date })`)
  
  return heading(2, isPatch ? small(fullTitle) : fullTitle)
}

export function preamblePartial(contest: FinalTemplateContext) {
  const { preamble, commitGroups, noteGroups } = contest
  return segments(
    preamble,
    isEmpty(preamble) && isEmpty(commitGroups) && isEmpty(noteGroups) && 'Version bump without any changes.',
  )
}

export function template(context: FinalTemplateContext) {
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
            const hasBody = note.commit.subject.trim() !== note.text.trim()
            const line2 = hasBody ? list([ note.text ], t => t) : ''
            
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
