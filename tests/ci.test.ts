import { describe, expect, it } from 'vitest'
import { Action } from '../src/action.js'


describe('ci mode tests', () => {
  it('use CI environment', async () => {
    process.env.CI = 'true'
    
    const action = new Action()
    const actual = action.handleRelease('patch', {})
    
    await expect(actual).rejects.toMatchObject({ code: 0 })
    
    const { runVersionPrompts } = await import('../src/version/prompts.js')
    expect(runVersionPrompts).not.toHaveBeenCalled()
    
    const { runNpmOptPrompts, runNpmPublishPrompts } = await import('../src/npm/prompts.js')
    expect(runNpmOptPrompts).not.toHaveBeenCalled()
    expect(runNpmPublishPrompts).toHaveBeenCalled()
    
    const { runGitPrompts } = await import('../src/git/prompts.js')
    expect(runGitPrompts).toHaveBeenCalled()
    
    const { runGithubPrompts } = await import('../src/github/prompts.js')
    expect(runGithubPrompts).toHaveBeenCalled()
  })
  
  it('use --ci option', async () => {
    const action = new Action()
    const actual = action.handleRelease('patch', { ci: true })
    
    await expect(actual).rejects.toMatchObject({ code: 0 })
    
    const { runVersionPrompts } = await import('../src/version/prompts.js')
    expect(runVersionPrompts).not.toHaveBeenCalled()
    
    const { runNpmOptPrompts, runNpmPublishPrompts } = await import('../src/npm/prompts.js')
    expect(runNpmOptPrompts).not.toHaveBeenCalled()
    expect(runNpmPublishPrompts).toHaveBeenCalled()
    
    const { runGitPrompts } = await import('../src/git/prompts.js')
    expect(runGitPrompts).toHaveBeenCalled()
    
    const { runGithubPrompts } = await import('../src/github/prompts.js')
    expect(runGithubPrompts).toHaveBeenCalled()
  })
})

describe('dryRun tests', () => {
  it('rolls back in dry run', async () => {
    const action = new Action()
    const actual = action.handleRelease('patch', { dryRun: true })
    
    await expect(actual).rejects.toMatchObject({ code: 0 })
    
    const { gitRollback } = await import('../src/git/commit.js')
    expect(gitRollback).toHaveBeenCalled()
  })
})
