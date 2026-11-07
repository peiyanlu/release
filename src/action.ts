import { getInput, setFailed, setOutput } from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { assert } from '@peiyanlu/ts-utils'
import {
  getInputOptions,
  getInputSkippedSteps,
  ifCommandComment,
  ifReleaseCommit,
  loadConfig,
  ReleaserGithubAction,
  type UserConfig,
} from './index.js'


const workflow = getInput('workflow')

console.log(`Triggered by: ${ context.eventName }`)
console.log(`Current workflow: ${ workflow }`)

if (workflow === 'check' && ifCommandComment() === false) {
  setOutput('continue', 'false')
  setOutput('workflow', 'none')
  process.exit(0)
}

const GITHUB_TOKEN = getInput('github-token', { required: true })
const NODE_AUTH_TOKEN = getInput('npm-token')
const inputOptions = getInputOptions()
const skippedSteps = getInputSkippedSteps()

if (NODE_AUTH_TOKEN) {
  process.env.NODE_AUTH_TOKEN = NODE_AUTH_TOKEN
}


try {
  const { config: { project, hosting, releaser, ...options }, file } = await loadConfig<UserConfig>(process.cwd())
  
  assert(project, 'Project is required.')
  
  console.log(`Legacy config file: ${ file }`)
  
  const gha = new ReleaserGithubAction({
    project,
    octokit: getOctokit(GITHUB_TOKEN),
    verbose: true,
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
    .setSkippedSteps(skippedSteps)
  
  switch (workflow) {
    case 'check':
      const isReleaseCommit = await ifReleaseCommit(gha)
      const workflow = isReleaseCommit ? 'release' : 'pull-request'
      
      console.log(`Next workflow: ${ workflow }`)
      
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
