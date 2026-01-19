import { vi } from 'vitest'


export class ExitError extends Error {
  constructor(public code?: string | number | null) {
    super(`process.exit(${ code })`)
    this.code = code
  }
}

vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})
vi.spyOn(process, 'exit').mockImplementation((code) => {
  throw new ExitError(code)
})

vi.mock('../src/git/commit.js', async () => {
  const actual = await vi.importActual('../src/git/commit.js')
  return {
    ...actual,
    gitCheck: vi.fn(),
    getLog: vi.fn().mockResolvedValue('feat: test'),
    getStatus: vi.fn().mockResolvedValue('M package.json'),
    commitAndTag: vi.fn(),
    resolveTag: vi.fn(),
    gitRollback: vi.fn(),
  }
})
vi.mock('../src/npm/publish.js', () => ({
  bump: vi.fn(),
  npmCheck: vi.fn().mockResolvedValue('ok'),
  publishNpm: vi.fn()
    .mockRejectedValue(new Error('otp'))
    .mockResolvedValue(void 0),
  isOtpError: vi.fn().mockReturnValue(true),
  getPackageUrl: () => 'https://npmjs.com/pkg',
}))
vi.mock('../src/github/release.js', () => ({
  createRelease: vi.fn(),
  getGithubReleaseUrl: () => 'https://github.com/release',
}))


vi.mock('../src/version/prompts.js', async () => {
  const actual = await vi.importActual('../src/version/prompts.js')
  return {
    ...actual,
    runVersionPrompts: vi.fn(),
  }
})
vi.mock('../src/npm/prompts.js', () => ({
  runNpmOptPrompts: vi.fn().mockResolvedValue('123456'),
  runNpmPublishPrompts: vi.fn().mockResolvedValue(void 0),
}))
vi.mock('../src/git/prompts.js', () => ({
  runGitPrompts: vi.fn(),
}))
vi.mock('../src/github/prompts.js', () => ({
  runGithubPrompts: vi.fn(),
}))


vi.mock('@peiyanlu/cli-utils', async () => {
  const actual = await vi.importActual('@peiyanlu/cli-utils')
  return {
    ...actual,
    readJsonFile: vi.fn().mockReturnValue({
      name: 'test-pkg',
      version: '1.0.0',
      private: false,
    }),
    execAsync: vi.fn(),
    isGitRepo: vi.fn().mockResolvedValue(true),
  }
})
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  log: {
    success: vi.fn(),
    message: vi.fn(),
  },
  group: vi.fn().mockResolvedValue({
    publish: vi.fn().mockResolvedValue(true),
  }),
  tasks: vi.fn().mockResolvedValue(void 0),
}))
