import { Octokit } from '@octokit/rest'
import { parseGitHubRepo } from '@peiyanlu/cli-utils'
import { contentType } from 'mime-types'
import { createReadStream, statSync } from 'node:fs'
import open from 'open'
import { glob } from 'tinyglobby'
import { normalizeTag } from '../git/commit.js'
import { MSG } from '../messages.js'
import { ReleaseContext, ResolvedConfig } from '../types.js'


export const getGithubUrl = (owner: string, repo: string) => {
  return `https://github.com/${ owner }/${ repo }`
}


const truncateBody = (body: string) => {
  if (body && body.length >= 124000) return body.substring(0, 124000) + '...'
  return body
}


const getLatestRelease = async (octokit: Octokit, owner: string, repo: string) => {
  const { data } = await octokit.repos.listReleases({
    owner,
    repo,
    per_page: 1,
    page: 1,
  })
  return data[0]
}

export const uploadAssets = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { github: { assets } } = config
  const { github: { isReleased, owner, repo, uploadUrl, releaseId, token }, pkg: { name } } = ctx
  
  if (!assets?.length || !isReleased) {
    return
  }
  
  const octokit = new Octokit({ auth: token })
  const files = await glob(assets)
  await Promise.all(files.map(file => {
    return octokit.repos.uploadReleaseAsset({
      owner,
      repo,
      name,
      url: uploadUrl,
      release_id: releaseId,
      data: createReadStream(file) as unknown as string,
      headers: {
        'content-type': contentType(file) || 'application/octet-stream',
        'content-length': statSync(file).size,
      },
    })
  }))
}

export const createWebRelease = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { pkg: { toPreRelease }, github: { owner, repo, changelog, releaseName }, git: { currentTag } } = ctx
  const { github: { prerelease } } = config
  
  const github = getGithubUrl(owner, repo)
  
  const url = new URL(`${ github }/releases/new`)
  
  url.searchParams.set('tag', currentTag)
  url.searchParams.set('title', releaseName)
  url.searchParams.set('body', truncateBody(changelog))
  url.searchParams.set('prelease', String(toPreRelease || prerelease))
  
  const isWindows = process.platform === 'win32'
  
  await open(url.toString(), { wait: isWindows })
}

export const createCiRelease = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { pkg: { toPreRelease }, github: { owner, repo, token, changelog, releaseName }, git: { currentTag } } = ctx
  const { github: { prerelease, draft, autoGenerate } } = config
  
  const octokit = new Octokit({ auth: token })
  try {
    const { data } = await octokit.repos.createRelease({
      owner,
      repo,
      // requestBody
      tag_name: currentTag,
      target_commitish: undefined,
      name: releaseName,
      body: autoGenerate ? '' : truncateBody(changelog),
      draft: draft ?? false,
      prerelease: (toPreRelease || prerelease) ?? false,
      discussion_category_name: undefined,
      generate_release_notes: autoGenerate,
      make_latest: 'true',
    })
    
    const { html_url, upload_url, id, discussion_url } = data
    Object.assign(ctx.github, {
      isReleased: true,
      releaseId: id,
      releaseUrl: html_url,
      uploadUrl: upload_url,
      discussionUrl: discussion_url,
    })
  } catch (e: any) {
    if (e?.status === 422) {
      throw new Error(MSG.ERROR.GITHUB_TAG_EXIT(currentTag))
    }
    
    throw e
  }
}

export const parseGithubUrl = (ctx: ReleaseContext) => {
  const { git: { remoteUrl } } = ctx
  const [ owner, repo ] = parseGitHubRepo(remoteUrl)
  Object.assign(ctx.github, { owner, repo })
}

export const createRelease = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { github: { owner, repo }, isCI } = ctx
  const { github: { tokenRef, release, skipChecks } } = config
  
  if (!release) return
  
  const token = tokenRef ? process.env[tokenRef] : process.env.GITHUB_TOKEN
  
  if (!token) {
    Object.assign(ctx.github, { isWeb: true })
    
    if (isCI && process.env.GITHUB_ACTIONS) {
      throw new Error(MSG.ERROR.GITHUB_TOKEN(tokenRef))
    }
  }
  
  Object.assign(ctx.github, { token })
  const octokit = new Octokit({ auth: token })
  
  if (token && !skipChecks) {
    if (process.env.GITHUB_ACTIONS) {
      Object.assign(ctx.github, { username: process.env.GITHUB_ACTOR })
    } else {
      try {
        const { data: { login: username } } = await octokit.users.getAuthenticated()
        Object.assign(ctx.github, { username })
      } catch (e) {
        throw new Error(MSG.ERROR.GITHUB_AUTH)
      }
      
      try {
        const { github: { username } } = ctx
        await octokit.repos.checkCollaborator({ owner, repo, username })
      } catch (e) {
        throw new Error(MSG.ERROR.GITHUB_USER)
      }
    }
  }
  
  const { github: { isWeb }, dryRun } = ctx
  
  if (dryRun) {
    return true
  }
  
  if (isWeb) {
    await createWebRelease(ctx, config)
  } else if (isCI) {
    await createCiRelease(ctx, config)
    await uploadAssets(ctx, config)
  }
}

export const getGithubReleaseUrl = (ctx: ReleaseContext) => {
  const { github: { owner, repo }, git: { currentTag } } = ctx
  return `${ getGithubUrl(owner, repo) }/releases/tag/${ normalizeTag(currentTag) }`
}
