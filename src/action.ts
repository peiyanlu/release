import { getInput, setFailed, setOutput } from '@actions/core'
import { getOctokit } from '@actions/github'
import { throwError } from '@peiyanlu/ts-utils'
import { loadConfig, type UserConfig } from './config/index.js'
import {
  getInputOptions,
  ifCommandComment,
  ifReleaseCommit,
  ReleaserGithubAction,
} from './releaser-github-action/index.js'


const workflow = getInput('workflow')

if (workflow === 'check' && ifCommandComment() === false) {
  setOutput('continue', 'false')
  setOutput('workflow', 'none')
  process.exit(0)
}

const GITHUB_TOKEN = getInput('github-token')
const NODE_AUTH_TOKEN = getInput('npm-token')
const inputOptions = getInputOptions()

if (NODE_AUTH_TOKEN) {
  process.env.NODE_AUTH_TOKEN = NODE_AUTH_TOKEN
}


try {
  const { config: { project, hosting, releaser, ...options }, file } = await loadConfig<UserConfig>(process.cwd())
  
  console.log(`Legacy config file: ${ file }`)
  
  if (!project) {
    throwError('Project is required.')
  }
  
  const gha = new ReleaserGithubAction({
    project,
    octokit: getOctokit(GITHUB_TOKEN),
    ...releaser,
  })
    .setOptions({
      ...options,
      checkout: {
        ...options.checkout,
        ...inputOptions.checkout,
      },
      bump: {
        ...options.bump,
        ...inputOptions.bump,
      },
      maintenanceBranch: {
        ...options.maintenanceBranch,
        ...inputOptions.maintenanceBranch,
      },
      publish: {
        ...options.publish,
        ...inputOptions.publish,
      },
    })
  
  switch (workflow) {
    case 'check':
      const isReleaseCommit = await ifReleaseCommit(gha)
      const workflow = isReleaseCommit ? 'release' : 'pull-request'
      
      setOutput('continue', 'true')
      setOutput('workflow', workflow)
      break
    case 'full':
      await gha.runAction()
      break
    case 'pull-request':
      await gha.runPullRequestAction()
      break
    case 'release':
      await gha.runReleaseAction()
      break
    case 'snapshot':
      await gha.runSnapshotAction(inputOptions.bump?.snapshot!)
      break
  }
} catch (error) {
  if (error instanceof Error) {
    setFailed(error.message)
  } else {
    setFailed('An unknown error occurred')
  }
  
  throw error
}
