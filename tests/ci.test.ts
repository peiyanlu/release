import { runNodeSync } from '@peiyanlu/cli-utils'
import { describe, expect, it } from 'vitest'


const CWD = process.cwd()

describe('release integration', () => {
  it('should release patch version', async () => {
    const res = runNodeSync([ CWD, '--dry-run', '-C', '--skip-npm', '--skip-git', '--skip-github' ], { error: 'throw' })
    expect(res).toContain('Select version bump:')
  })
})
