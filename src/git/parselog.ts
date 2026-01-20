export interface ParsedCommit {
  type: string
  scope?: string
  breaking: boolean
  description: string
  gitmoji?: string[]
  pr?: string
  breaks?: string
  issues?: Record<IssueLinkType, number[]>
  header?: string
  body?: string
  footer?: string
  shortHash: string
  fullHash: string
}

type IssueLinkType = 'fixes' | 'closes' | 'resolves' | 'related' | 'refs';


const extractNumbers = (text: string) => Array
  .from(text.matchAll(/#(\d+)/g))
  .map(m => Number(m[1]))

export const parseIssueFooters = (body: string) => {
  const lines = body.split('\n').map(l => l.trim()).filter(Boolean)
  
  const typeMatchers: Record<IssueLinkType, RegExp> = {
    fixes: /^Fixes/i,
    closes: /^Closes/i,
    resolves: /^Resolves/i,
    related: /^(Related to|Related)/i,
    refs: /^Refs?/i,
  }
  
  const res: Record<IssueLinkType, number[]> = {
    fixes: [],
    closes: [],
    resolves: [],
    related: [],
    refs: [],
  }
  
  for (const line of lines) {
    for (const [ type, regex ] of Object.entries(typeMatchers)) {
      if (regex.test(line)) {
        const nums = extractNumbers(line)
        nums.forEach(n => {
          res[type as IssueLinkType].push(n)
        })
      }
    }
  }
  
  return res
}

export const parseCommit = (
  header: string,
  body: string,
  footer: string,
  shortHash: string,
  fullHash: string,
): ParsedCommit | undefined => {
  // 🔹
  
  const str = `
    ^\\s*
    (?:(?<gitmoji1>[\\u{1F300}-\\u{1FAFF}]|:[a-z0-9+_\\-]+:))?
    \\s*
    (?<type>\\w+)(?:\\((?<scope>[^)]+)\\))?(?<breaking>!)?:
    \\s*
    (?:(?<gitmoji2>[\\u{1F300}-\\u{1FAFF}]|:[a-z0-9+_\\-]+:))?
    \\s*
    (?<description>.+?)
    \\s*
    (?:\\(#(?<pr>\\d+)\\))?
    \\s*$
  `.replace(/\n\s+/g, '')
  const reg = new RegExp(str, 'u')
  const match = header.match(reg)
  if (!match?.groups) {
    return {
      type: '',
      description: '',
      breaking: false,
      shortHash,
      fullHash,
      header,
      body,
      footer,
    }
  }
  
  const breaksReg = /BREAKING CHANGE:\s*(?<breaks>.+)/i
  const breaksMatch = footer.match(breaksReg)
  let breaks: string | undefined
  if (breaksMatch?.groups) {
    let { groups: { breaks: temp } } = breaksMatch
    breaks = temp
  }
  
  const { groups: { type, scope, breaking, description, gitmoji1, gitmoji2, pr } } = match
  return {
    type,
    scope,
    breaking: !!breaking || !!breaks,
    gitmoji: [ gitmoji1, gitmoji2 ].filter(Boolean),
    description: description.trim(),
    pr,
    breaks,
    issues: parseIssueFooters(footer),
    shortHash,
    fullHash,
    header,
    body,
    footer,
  }
}

const normalizeLineEndings = (s: string) =>
  s.trim().replace(/\r\n/g, '\n')

const isGitCommitFooterLine = (line: string) => {
  if (!line) return false
  
  return (
    // 1) BREAKING CHANGE
    /^BREAKING CHANGE:/.test(line) ||
    
    // 2) Token: value 例如: Refs: #123 / Reviewed-by: Z
    /^[A-Za-z-]+(-[A-Za-z]+)*:\s+.+/.test(line) ||
    
    // 3) Token #value 例如: Fixes #123 / Closes #456 / Refs #789
    /^[A-Za-z-]+\s+#\d+/.test(line)
  )
}

export const splitCommitBodyAndFooter = (raw: string) => {
  const message = normalizeLineEndings(raw)
  const lines = message.trim().split('\n')
  
  let footerStart = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    
    if (isGitCommitFooterLine(line)) {
      footerStart = i
    } else if (footerStart !== -1 && line === '') {
      // footer 上方的空行，作为分界点
      break
    }
  }
  const slice2str = (str: string[], s?: number, e?: number) => {
    return str.slice(s, e).join('\n').trim()
  }
  
  if (footerStart === -1) {
    return {
      body: slice2str(lines, 0),
      footer: '',
    }
  }
  
  return {
    body: slice2str(lines, 0, footerStart),
    footer: slice2str(lines, footerStart),
  }
}


export const parseCommits = (commits: string[] = []) => {
  return commits
    .map(raw => {
      const [ fullHash, shortHash, subject, ...bodyFooter ] = raw.trim().split('\n').filter(Boolean)
      const { body, footer } = splitCommitBodyAndFooter(bodyFooter.join('\n'))
      
      return parseCommit(subject, body, footer, shortHash, fullHash)
    })
    .filter((i): i is Exclude<typeof i, undefined> => i !== undefined)
}
