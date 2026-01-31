import { Octokit } from '@octokit/rest'
import { getGithubUrl } from '@peiyanlu/cli-utils'
import { contentType } from 'mime-types'
import { createReadStream, statSync } from 'node:fs'
import open from 'open'
import { glob } from 'tinyglobby'
import { MSG } from '../messages.js'
import { ReleaseContext, ResolvedConfig } from '../types.js'


interface UploadAssets {
  owner: string
  repo: string
  name: string
  uploadUrl: string
  releaseId: number
  assets: string[]
}

interface WebRelease {
  owner: string
  repo: string
  tag: string
  title: string
  body: string
  prerelease: string
}

interface BaseOptions {
  owner: string
  repo: string
  tag: string
}

interface CreateRelease extends BaseOptions {
  name: string
  body: string
  draft: boolean
  prerelease: boolean
  generateReleaseNotes: boolean
  makeLatest?: 'true' | 'false' | 'legacy'
  targetCommitish?: string
  discussionCategoryName?: string
}

interface UpdateRelease extends CreateRelease {
  releaseId: number
}


const truncateBody = (body: string) => {
  if (body && body.length >= 124000) {
    return body.substring(0, 124000) + '...'
  }
  return body
}

const getReleaseByTagSafe = async (octokit: Octokit, options: BaseOptions) => {
  try {
    const { data } = await octokit.repos.getReleaseByTag({ ...options })
    return data
  } catch (e: any) {
    if (e?.status === 404) return null
    throw e
  }
}

const createCRelease = async (octokit: Octokit, options: CreateRelease) => {
  const {
    owner,
    repo,
    tag,
    name,
    body,
    draft,
    prerelease,
    generateReleaseNotes,
    makeLatest,
    targetCommitish,
    discussionCategoryName,
  } = options
  const { data } = await octokit.repos.createRelease({
    owner,
    repo,
    tag_name: tag,
    name: name,
    body: body,
    draft: draft,
    prerelease: prerelease,
    generate_release_notes: generateReleaseNotes,
    make_latest: makeLatest,
    target_commitish: targetCommitish,
    discussion_category_name: discussionCategoryName,
  })
  return data
}

const updateCRelease = async (octokit: Octokit, options: UpdateRelease) => {
  const {
    owner,
    repo,
    tag,
    name,
    body,
    draft,
    prerelease,
    generateReleaseNotes,
    makeLatest,
    targetCommitish,
    discussionCategoryName,
    releaseId,
  } = options
  const { data } = await octokit.repos.updateRelease({
    owner,
    repo,
    release_id: releaseId,
    tag_name: tag,
    name: name,
    body: body,
    draft: draft,
    prerelease: prerelease,
    generate_release_notes: generateReleaseNotes,
    make_latest: makeLatest,
    target_commitish: targetCommitish,
    discussion_category_name: discussionCategoryName,
  })
  return data
}

const createCReleaseByTag = async (octokit: Octokit, options: CreateRelease) => {
  const existing = await getReleaseByTagSafe(octokit, options)
  
  if (!existing) {
    return createCRelease(octokit, { ...(options as CreateRelease) })
  }
  
  const { draft, id: releaseId } = existing
  
  if (!draft) {
    throw new Error(`Release for tag "${ options.tag }" already exists and is not a draft`)
  }
  
  return updateCRelease(octokit, { releaseId, ...options })
}

const uploadAssets = async (octokit: Octokit, options: UploadAssets) => {
  const { owner, repo, name, uploadUrl, releaseId, assets } = options
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

const createWebRelease = async (options: WebRelease) => {
  const { owner, repo, tag, title, body, prerelease } = options
  
  const url = new URL(`${ getGithubUrl(owner, repo) }/releases/new`)
  
  Object
    .entries({ tag, title, body, prerelease })
    .forEach(([ key, value ]) => {
      url.searchParams.set(key, value)
    })
  
  const isWindows = process.platform === 'win32'
  await open(url.toString(), { wait: isWindows })
}


export const githubCheck = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { github: { owner, repo }, isCI } = ctx
  const { github: { tokenRef, skipChecks } } = config
  
  const token = tokenRef ? process.env[tokenRef] : process.env.GITHUB_TOKEN
  if (!token) {
    Object.assign(ctx.github, { isWeb: true })
    
    if (isCI && process.env.GITHUB_ACTIONS) {
      throw new Error(MSG.ERROR.GITHUB_TOKEN(tokenRef))
    }
    
    return ''
  }
  Object.assign(ctx.github, { token })
  
  if (skipChecks) return ''
  
  let username = ''
  if (process.env.GITHUB_ACTIONS) {
    username = process.env.GITHUB_ACTOR!
  } else {
    
    const octokit = new Octokit({ auth: token })
    try {
      const { data: { login } } = await octokit.users.getAuthenticated()
      username = login
    } catch (e) {
      throw new Error(MSG.ERROR.GITHUB_AUTH)
    }
    
    try {
      await octokit.repos.checkCollaborator({ owner, repo, username })
    } catch (e) {
      throw new Error(MSG.ERROR.GITHUB_USER)
    }
  }
  
  return username
}

export const createRelease = async (ctx: ReleaseContext, config: ResolvedConfig) => {
  const { pkg: { name, toPreRelease }, git: { currentTag }, isCI, dryRun } = ctx
  const { github: { isWeb, token, owner, repo, changelog, releaseName } } = ctx
  const { github: { release, assets, prerelease, autoGenerate, draft } } = config
  
  if (!release || dryRun) return
  
  const octokit = new Octokit({ auth: token })
  
  if (isWeb) {
    await createWebRelease({
      owner,
      repo,
      tag: currentTag,
      title: releaseName,
      body: truncateBody(changelog),
      prerelease: String(toPreRelease || prerelease),
    })
  } else if (isCI) {
    const res = await createCReleaseByTag(octokit, {
      owner,
      repo,
      tag: currentTag,
      name: releaseName,
      body: autoGenerate ? '' : truncateBody(changelog),
      draft: draft,
      prerelease: toPreRelease || prerelease,
      generateReleaseNotes: autoGenerate,
      makeLatest: 'true',
    })
    if (!res) return
    
    if (assets.length) {
      const { id: releaseId, upload_url: uploadUrl } = res
      await uploadAssets(octokit, { owner, repo, name, uploadUrl, releaseId, assets })
    }
  }
}
