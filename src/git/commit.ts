import {
  getAllRemotes,
  getCurrentBranch,
  getRemote,
  gitAddAll,
  gitAddTracked,
  gitCommit,
  gitTagAnnotated,
  isGitRepo,
  isWorkingDirClean, parseGitHubRepo,
  pushBranch,
  pushTag,
} from '@peiyanlu/cli-utils'
import { spawnSync } from 'node:child_process'
import { MSG } from '../messages.js'
import { ReleaseContext, ResolvedConfig } from '../types.js'


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
  
  // parseGithubUrl(ctx)
  
  const [ owner, repo ] = parseGitHubRepo(remoteUrl)
  Object.assign(ctx.github, { owner, repo })
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
  
  addUntrackedFiles ? await gitAddAll() : await gitAddTracked(args)
  await gitCommit(commitMessage, [ ...commitArgs, ...args ])
  
  if (!dryRun) {
    Object.assign(ctx.git, { isCommitted: true })
  }
  
  if (tag) {
    await gitTagAnnotated(currentTag, tagMessage, [ ...tagArgs, ...args ])
    
    if (!dryRun) {
      Object.assign(ctx.git, { isTagged: true })
    }
  }
  
  if (push) {
    const remotes = await getAllRemotes()
    for (const remoteName of remotes) {
      await pushTag(remoteName, currentTag, args)
      await pushBranch(remoteName, await getCurrentBranch(), [ ...pushArgs, ...args ])
    }
    
    if (!dryRun) {
      Object.assign(ctx.git, { isPushed: true })
    }
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
