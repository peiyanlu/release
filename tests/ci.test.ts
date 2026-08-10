import { runNodeSync } from '@peiyanlu/cli-utils'
import { describe, expect, it, vi } from 'vitest'


const CWD = process.cwd()

describe('release integration', () => {
  it('prompts for the bump version if none supplied', async () => {
    if (process.env.GITHUB_ACTIONS) {
      vi.stubEnv('GITHUB_TOKEN', 'ghp_Odds4gT0mr')
    }
    
    const res = runNodeSync([ CWD, '--dry-run', '-C', '--skip-npm', '--skip-git', '--skip-github' ], { error: 'throw' })
    
    if (!process.env.CI) {
      expect(res).toContain('Select version bump:')
    } else {
      expect(res).toContain('Release finished successfully')
    }
  })
  
  it('should run success when ci dry-run', async () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true')
    
    if (process.env.GITHUB_ACTIONS) {
      vi.stubEnv('GITHUB_TOKEN', 'ghp_Odds4gT0mr')
    }
    
    const res = runNodeSync([ CWD, '--dry-run', '-C', '--skip-npm', '--skip-git', '--skip-github' ], { error: 'throw' })
    expect(res).toContain('Release finished successfully')
  })
  
  it('should throw err when ci mode no token', () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true')
    vi.stubEnv('GITHUB_TOKEN', '')
    
    const res = () => runNodeSync([ CWD, '--dry-run', '-C', '--skip-npm' ], { error: 'throw' })
    expect(res).toThrow()
  })
})
