import { Octokit } from '@octokit/rest'
import { getGithubUrl } from '@peiyanlu/cli-utils'
import { gitBranchCurrent } from '@peiyanlu/git-utils'
import { readTextFileSync } from '@peiyanlu/node-utils'
import { dedent, isEmpty, newline, sleep, throwError, tryCall } from '@peiyanlu/ts-utils'
import { parse } from 'node:path'
import open from 'open'
import { glob } from 'tinyglobby'
import { type CreateReleaseOptions, GitRepositoryHosting, type Project } from '../core/index.ts'
import type {
  GetReleaseOptions,
  GithubCreatePullRequestOptions,
  GithubOptions,
  ListPullRequestOptions,
  RepositoryId,
  UploadAssetsOptions,
} from './github.type.ts'


export class GithubHosting extends GitRepositoryHosting {
  readonly octokit: Octokit
  readonly browser: boolean
  
  constructor(private readonly options: GithubOptions = {}) {
    const { octokit, token, browser } = options
    
    super()
    
    this.browser = browser ?? (!octokit && !token)
    this.octokit = octokit ?? new Octokit({ auth: token })
  }
  
  async createRelease(options: CreateReleaseOptions): Promise<void> {
    const { project, dryRun, logger } = options
    const { octokit, browser } = this
    
    const releaseData = await project.getReleaseData()
    if (isEmpty(releaseData)) {
      logger?.info('No release data found. Skipping release creation.')
      return
    }
    
    const [ owner, repo ] = await this.getRepositoryId(project)
    
    for (const data of releaseData) {
      logger?.verbose(`Creating GitHub release "${ data.title }"...`)
      
      const browserRelease = async () => {
        const url = new URL(`${ getGithubUrl(owner, repo) }/releases/new`)
        const opts = {
          tag: data.nextTag,
          title: data.title,
          body: data.notes,
          prerelease: data.isPrerelease,
        }
        
        logger?.verbose(`GitHub release page parameters:`)
        logger?.verbose(opts)
        
        Object
          .entries(opts)
          .forEach(([ key, value ]) => {
            url.searchParams.set(key, String(value))
          })
        
        logger?.verbose(`Opening GitHub release page for tag "${ data.nextTag }"...`)
        
        await open(url.toString())
        await sleep(1000 * 1.5)
      }
      
      const resetRelease = async () => {
        const res = await (async () => {
          const release = await this.getRelease({ owner, repo, tag: data.nextTag })
          
          const opts = {
            owner,
            repo,
            tag_name: data.nextTag,
            name: data.title,
            body: data.notes,
            prerelease: data.isPrerelease,
            make_latest: (data.isLatest ? 'true' : 'false') as 'true' | 'false' | 'legacy',
          }
          
          logger?.verbose(`GitHub release ${ release ? 'update' : 'creation' } options:`)
          logger?.verbose(opts)
          
          if (release) {
            const { data } = await octokit.rest.repos.updateRelease({ ...opts, release_id: release.id })
            return data
          } else {
            const { data } = await octokit.rest.repos.createRelease({ ...opts, draft: false })
            return data
          }
        })()
        
        if (!res) return
        
        await this.uploadAssets({ owner, repo, release_id: res.id, assets: [] })
      }
      
      if (!dryRun) {
        browser ? await browserRelease() : await resetRelease()
      }
    }
  }
  
  async createPullRequest(options: GithubCreatePullRequestOptions): Promise<void> {
    const { project, dryRun, draft, logger } = options
    let { from, to } = options
    const { octokit } = this
    
    const [ owner, repo ] = await this.getRepositoryId(project)
    
    from ||= await gitBranchCurrent()
    to ||= await this.getDefaultBranch(owner, repo)
    
    if (from === to) {
      throwError('Cannot create a pull request from the same branch.')
    }
    
    const [ pr ] = await this.listPullRequest({ owner, repo, from })
    
    if (pr) {
      logger?.info(`Updating existing pull request #${ pr.number }.`)
    }
    
    logger?.verbose('Pull request data:')
    
    if (!pr && draft) {
      logger?.verbose('Draft: true')
    }
    
    const { title, body } = await this.getPullRequestData(project, from, to)
    
    logger?.verbose(`${ from } -> ${ to }`)
    logger?.verbose(`Title: ${ title }`)
    logger?.verbose(`Body:\n\n${ body }`)
    
    const opts = {
      owner,
      repo,
      title,
      body,
    }
    if (!dryRun) {
      if (pr) {
        await octokit.rest.pulls.update({
          ...opts,
          pull_number: pr.number,
        })
      } else {
        await octokit.rest.pulls.create({
          ...opts,
          base: to,
          head: from,
          draft,
        })
      }
    }
  }
  
  async getRepositoryId(project: Project): Promise<RepositoryId> {
    let { options: { owner, repo } } = this
    const i = project.getHostedGitInfo()
    
    return [ owner ?? (await i).owner, repo ?? (await i).repo ] as RepositoryId
  }
  
  private async uploadAssets(options: UploadAssetsOptions) {
    const { octokit } = this
    const { owner, repo, release_id, assets } = options
    const files = await glob(assets)
    
    await Promise.all(files.map(file => {
      const { base: filename } = parse(file)
      return octokit.rest.repos.uploadReleaseAsset({
        owner,
        repo,
        release_id,
        name: filename,
        data: readTextFileSync(file),
      })
    }))
  }
  
  private async getRelease(options: GetReleaseOptions) {
    const { octokit } = this
    
    const { data } = await tryCall(
      () => octokit.rest.repos.getReleaseByTag({ ...options }),
      { data: undefined },
    )
    
    return data
  }
  
  private async listPullRequest(options: ListPullRequestOptions) {
    const { octokit } = this
    const { owner, repo, from } = options
    
    const { data } = await tryCall(
      () => octokit.rest.pulls.list({
        owner,
        repo,
        head: `${ owner }:${ from }`,
        state: 'open',
      }),
      { data: [] },
    )
    
    return data
  }
  
  private async getDefaultBranch(owner: string, repo: string) {
    const { octokit } = this
    
    const { data: { default_branch } } = await tryCall(
      () => octokit.rest.repos.get({ owner, repo }),
      { data: { default_branch: 'master' } },
    )
    
    return default_branch
  }
  
  private async getPullRequestData(project: Project, from: string, to: string) {
    const message = await project.getCommitMessage()
    const title = message.split('\n')[0]
    const updates = project
      .versionUpdates
      .map(({ name, notes }) => `# ${ name }${ newline(2) }${ notes.trim() }`)
      .join(newline(2))
    
    const body = [
      updates,
      dedent(`
        <!--
          Release pull request metadata.
          release-pull-request: true
          release-branch-from: ${ from }
          release-branch-to: ${ to }
        -->
      `),
    ]
      .join(newline(2))
    
    return { title, body }
  }
}

export { Octokit }
