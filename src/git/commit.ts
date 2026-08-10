import {
  getRemoteList,
  getRemoteNames,
  gitAddAll,
  gitAddTracked,
  gitBranchCurrent,
  gitCommitMessage,
  gitPushBranch,
  gitPushTag,
  gitResetHardSync,
  gitTagAnnotated,
  gitTagDeleteSync,
  isGitRepo,
  isWorkingTreeClean,
} from '@peiyanlu/cli-utils'
import { MSG } from '../messages.js'
import type { ReleaseContext, ResolvedConfig } from '../types.js'


export const gitCheck = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { pkg: { name } } = ctx
  const { git: { requireRepository, requireRemote, requireCleanWorkingTree } } = config
  
  const isRepo = await isGitRepo()
  if (!isRepo) {
    if (requireRepository) {
      throw new Error(MSG.ERROR.GIT_REGISTRY(name))
    } else {
      ctx.noGit = true
      return
    }
  }
  
  if (requireCleanWorkingTree && !await isWorkingTreeClean()) {
    throw new Error(MSG.ERROR.GIT_WORKDIR)
  }
  
  const remote = (await getRemoteList())[0]
  const { name: remoteName = 'origin', url: remoteUrl } = remote ?? {}
  if (!remote || !remoteUrl) {
    if (requireRemote) {
      throw new Error(MSG.ERROR.GIT_REMOTE(remoteName))
    }
  }
  Object.assign(ctx.git, { remoteName, remoteUrl })
}

export const commitAndTag = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { git: { currentTag, commitMessage, tagMessage }, dryRun } = ctx
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
  
  addUntrackedFiles ? await gitAddAll(args) : await gitAddTracked(args)
  await gitCommitMessage(commitMessage, [ ...commitArgs, ...args ])
  
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
    const remotes = await getRemoteNames()
    for (const remoteName of remotes) {
      await gitPushTag(remoteName, currentTag, args)
      await gitPushBranch(remoteName, await gitBranchCurrent(), [ ...pushArgs, ...args ])
    }
    
    if (!dryRun) {
      Object.assign(ctx.git, { isPushed: true })
    }
  }
}

export const gitRollback = (ctx: ReleaseContext) => {
  const { git: { currentTag, isCommitted, isTagged, isPushed } } = ctx
  
  if (isPushed) return
  
  if (isTagged) {
    gitTagDeleteSync(currentTag)
  }
  
  gitResetHardSync(isCommitted ? 1 : 0)
}
