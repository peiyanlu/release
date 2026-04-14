import { getInput, setFailed } from '@actions/core'
import { getOctokit, context } from '@actions/github'


async function run() {
  try {
    const github = getOctokit(process.env.GITHUB_TOKEN!)
    
    const { owner, repo } = context.repo
    
    const tagName = getInput('tag_name', { required: true })
    
    // from 'refs/tags/v1.10.15' to 'v1.10.15'
    const tag = tagName.replace('refs/tags/', '')
    
    const releaseName = getInput('release_name', { required: false }) || tag
    const body = getInput('body', { required: false }) || ''
    const draft = getInput('draft', { required: false }) === 'true'
    
    const prerelease = /\d-[a-z]/.test(tag)
    
    await github.rest.repos.createRelease({
      owner,
      repo,
      tag_name: tag,
      name: releaseName,
      body,
      draft,
      prerelease,
    })
  } catch (error: any) {
    setFailed(error.message)
  }
}

await run()
