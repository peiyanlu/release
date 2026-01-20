import { isGitRepo, runGit } from '@peiyanlu/cli-utils'
import { dim } from 'ansis'
import { spawnSync } from 'node:child_process'
import { clean, rcompare, valid } from 'semver'
import { parseGithubUrl } from '../github/release.js'
import { MSG } from '../messages.js'
import { ReleaseContext, ResolvedConfig } from '../types.js'


export const getBranchName = async () => {
  let branch = await runGit([ 'branch', '--show-current' ])
  
  if (!branch) {
    // fallback for very old git
    branch = await runGit([ 'rev-parse', '--abbrev-ref', 'HEAD' ])
    if (branch === 'HEAD') return undefined
  }
  
  return branch
}

export const getRemoteForBranch = (branch: string) => {
  return runGit([ 'config', '--get', `branch.${ branch }.remote` ])
}

export const getAllRemotes = async () => {
  const res = await runGit([ 'remote' ])
  return res?.split('\n').filter(Boolean) ?? []
}

export const getDefaultRemote = async (branch?: string) => {
  const targetBranch = branch || await getBranchName()
  return targetBranch ? await getRemoteForBranch(targetBranch) : undefined
}

export const getOtherRemotes = async (branch?: string) => {
  const defaultRemote = await getDefaultRemote(branch)
  const all = await getAllRemotes()
  return all.filter(r => r !== defaultRemote)
}

export const fetchAllBranch = (remoteName = 'origin') => {
  return runGit([
    '-c',
    'credential.helper=',
    'fetch',
    remoteName,
    '--recurse-submodules=no',
    '--prune',
  ])
}

export const getTags = async () => {
  const tag = await runGit([ 'tag' ])
  return tag
    ? tag
      .split('\n')
      .filter(tag => valid(clean(tag)))
      .sort(rcompare)
    : []
}

export const getRemoteTags = (match = '*', count = 1) => {
  return runGit([
    'for-each-ref',
    '--sort=-v:refname',
    '--format=%(refname:short)',
    `--count=${ count }`,
    `refs/tags/${ match }`,
  ])
}

export const getStatus = () => {
  return runGit([ 'status', '--short', '--untracked-files=no' ], { trim: false })
}

export const gitRestore = () => {
  return runGit([ 'restore', '.' ])
}

export const coloredChangeset = (log: string) => {
  const colorStatusChar = (ch: string) => {
    switch (ch) {
      case 'M':
        return `\x1b[33m${ ch }\x1b[0m` // yellow
      case 'A':
        return `\x1b[32m${ ch }\x1b[0m` // green
      case 'D':
        return `\x1b[31m${ ch }\x1b[0m` // red
      default:
        return ch
    }
  }
  
  const colorStatus = (status: string) => status
    .split('')
    .map(colorStatusChar)
    .join('')
  
  return log
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2)
      const file = line.slice(3)
      return `${ colorStatus(status) } ${ dim(file) }`
    })
    .join('\n')
}

export const getRemote = async () => {
  const branch = await getBranchName()
  const remoteName = (branch && await getRemoteForBranch(branch)) || 'origin'
  
  const remoteUrl = await runGit([ 'remote', 'get-url', remoteName ])
    .catch(_ => runGit([ 'config', '--get', `remote.${ remoteName }.url` ]))
  
  return { remoteName, remoteUrl }
}

export const getLatestTag = async (match = '*', exclude = '*-beta.*') => {
  return runGit([
    'describe',
    '--tags',
    '--abbrev=0',
    `--match=${ match }`,
    `--exclude=${ exclude }`,
  ])
}

export const getLatestTagFromAllRefs = async (match = '*') => {
  return runGit([
    '-c',
    'versionsort.suffix=-',
    'for-each-ref',
    '--count=1',
    '--sort=-v:refname',
    '--format=%(refname:short)',
    `refs/tags/${ match }`,
  ])
}

export const getPreviousTag = async (current?: string) => {
  const sha = await runGit([ 'rev-list', '--tags', current || '--skip=1', '--max-count=1' ])
  return runGit([ 'describe', '--tags', '--abbrev=0', `${ sha }^` ])
}

export const getFullHash = (short: string) => {
  return runGit([ 'rev-parse', short ])
}

export const resolveChangelogRange = async (isIncrement: boolean = true) => {
  const latestTag = await getLatestTag()
  const previousTag = await getPreviousTag(latestTag)
  
  // 没有任何 tag 只能从 HEAD 往回
  if (!latestTag) {
    return { from: '', to: 'HEAD' }
  }
  
  // 版本不发生变化
  if (!isIncrement && previousTag) {
    return { from: previousTag, to: `${ latestTag }^1` }
  }
  
  // 正常 release
  return { from: latestTag, to: 'HEAD' }
}

export const getLog = async (from = '', to = 'HEAD') => {
  const cmd = [ 'log', `--pretty=format:* %s (%h)` ]
  if (from) cmd.push(`${ from }...${ to }`)
  
  return runGit(cmd, { trim: false })
}

export const isWorkingDirClean = async () => {
  // return runGit([ 'diff', '--quiet', 'HEAD' ])
  const status = await runGit([ 'status', '-s' ])
  return status?.length === 0
}

export const isRemoteName = (remoteName: string) => {
  return remoteName && !remoteName.includes('/')
}

export const hasUpstreamBranch = async () => {
  const ref = await runGit([ 'symbolic-ref', 'HEAD' ])
  const branch = await runGit([ 'for-each-ref', '--format=%(upstream:short)', ref! ])
  return Boolean(branch)
}

export const getUpstreamArgs = async (remoteName: string) => {
  const hasUpstream = await hasUpstreamBranch()
  const branch = await getBranchName()
  
  if (!hasUpstream) {
    return [ '--set-upstream', remoteName, branch! ]
  }
  
  return [ remoteName, branch! ]
}

export const countCommitsSinceLatestTag = async () => {
  const latestTag = await getLatestTag()
  const ref = latestTag ? `${ latestTag }...HEAD` : 'HEAD'
  return runGit([ 'rev-list', ref, '--count' ]).then(Number)
}


export const normalizeTag = (tag: string) => clean(tag) ?? tag

export const gitCheck = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { pkg: { name } } = ctx
  const { git: { requireRepository, requireRemote, requireWorkDirClean } } = config
  
  const isRepo = await isGitRepo()
  if (!isRepo) {
    if (requireRepository) {
      throw new Error(MSG.ERROR.GIT_REGISTRY(name))
    } else {
      ctx.noGit = true
      return
    }
  }
  
  if (requireWorkDirClean && !await isWorkingDirClean()) {
    throw new Error(MSG.ERROR.GIT_WORKDIR)
  }
  
  const { remoteName, remoteUrl } = await getRemote()
  if (!remoteUrl) {
    if (requireRemote) {
      throw new Error(MSG.ERROR.GIT_REMOTE(name))
    } else {
      ctx.noGitHub = true
      return
    }
  }
  Object.assign(ctx.git, { remoteName, remoteUrl })
  
  parseGithubUrl(ctx)
}

export const commitAndTag = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { git: { remoteName, currentTag, commitMessage, tagMessage }, dryRun } = ctx
  const {
    git: {
      commit,
      tag,
      push,
      addUntrackedFiles,
      commitArgs,
      tagArgs,
      pushArgs,
    },
  } = config
  if (!commit) return
  
  const args = dryRun ? [ '--dry-run' ] : []
  
  await runGit([ 'add', '.', addUntrackedFiles ? '--all' : '--update', ...args ])
  await runGit([ 'commit', '--message', commitMessage, ...commitArgs, ...args ])
  
  if (!dryRun) {
    Object.assign(ctx.git, { isCommitted: true })
  }
  
  if (tag) {
    await runGit([ 'tag', '--annotate', '--message', tagMessage, currentTag, ...tagArgs, ...args ])
    
    if (!dryRun) {
      Object.assign(ctx.git, { isTagged: true })
    }
  }
  
  if (push) {
    const remotes = await getAllRemotes()
    for (const remoteName of remotes) {
      const upstreamArgs = await getUpstreamArgs(remoteName)
      await runGit([ 'push', remoteName, `refs/tags/${ currentTag }`, ...args ])
      await runGit([ 'push', ...upstreamArgs, ...pushArgs, ...args ])
    }
    
    Object.assign(ctx.git, { isPushed: true })
  }
}

export const gitRollback = (ctx: ReleaseContext) => {
  const { git: { currentTag, isCommitted, isTagged, isPushed } } = ctx
  
  if (isPushed) return
  
  spawnSync('git', [ 'restore', '.' ])
  
  if (isTagged) {
    spawnSync('git', [ 'tag', '--delete', currentTag ])
  }
  
  spawnSync('git', [ 'reset', '--hard', isCommitted ? 'HEAD~1' : 'HEAD' ])
}
