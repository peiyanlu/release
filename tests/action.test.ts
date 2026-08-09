import { expect, it } from 'vitest'
import { Action, type ReleaseCliOptions } from '../src/action.js'
import { createDefaultConfig } from '../src/defaults.js'


it('should respect default config when no configFile', async () => {
  const action = new Action()
  
  const options = {
    ci: false,
    requireCleanWorkingTree: true,
  } as ReleaseCliOptions
  
  const def = createDefaultConfig(options.ci)
  
  const { configFile, config } = await action.createConfig(options)
  
  expect(configFile).toBe('')
  
  expect(config.changelog.releaseCount).toBe(def.changelog.releaseCount)
  expect(config.changelog.includeHidden).toBe(def.changelog.includeHidden)
  expect(config.git.requireCleanWorkingTree).toBe(def.git.requireCleanWorkingTree)
  expect(config.skipGit).toBe(def.skipGit)
  expect(config.skipNpm).toBe(def.skipNpm)
  expect(config.skipGithub).toBe(def.skipGithub)
  expect(config.isMonorepo).toBe(def.isMonorepo)
})

it('should respect cli config options', async () => {
  const action = new Action()
  
  const options = {
    ci: false,
    requireCleanWorkingTree: false,
    releaseCount: 10,
    isMonorepo: true,
    includeHidden: true,
  } as ReleaseCliOptions
  
  const def = createDefaultConfig(options.ci)
  
  const { configFile, config } = await action.createConfig(options)
  
  expect(configFile).toBe('')
  
  expect(config.changelog.releaseCount).toBe(10)
  expect(config.changelog.includeHidden).toBe(true)
  expect(config.git.requireCleanWorkingTree).toBe(false)
  expect(config.skipGit).toBe(def.skipGit)
  expect(config.skipNpm).toBe(def.skipNpm)
  expect(config.skipGithub).toBe(def.skipGithub)
  expect(config.isMonorepo).toBe(true)
})

it('should respect config from configFile', async () => {
  class TestAction extends Action {
    public async resolveUserConfig<T>(cwd: string = process.cwd()): Promise<{ configFile: string; config: T }> {
      return  {
        configFile: '',
        config: {
          changelog: {
            releaseCount: 0,
            includeHidden: true,
          },
          git: {
            requireCleanWorkingTree: false,
          },
          skipGit: true,
          skipNpm: true,
          skipGithub: true,
          isMonorepo: true,
        } as T
      }
    }
  }
  
  const action = new TestAction()
  
  const options = {
    ci: false,
    requireCleanWorkingTree: true,
  } as ReleaseCliOptions
  
  const { configFile, config } = await action.createConfig(options)
  
  expect(configFile).toBe('')
  
  expect(config.changelog.releaseCount).toBe(0)
  expect(config.changelog.includeHidden).toBe(true)
  expect(config.git.requireCleanWorkingTree).toBe(false)
  expect(config.skipGit).toBe(true)
  expect(config.skipNpm).toBe(true)
  expect(config.skipGithub).toBe(true)
  expect(config.isMonorepo).toBe(true)
})

it('should respect config from cli and configFile', async () => {
  class TestAction extends Action {
    public async resolveUserConfig<T>(cwd: string = process.cwd()): Promise<{ configFile: string; config: T }> {
      return  {
        configFile: '',
        config: {
          changelog: {
            releaseCount: 10,
            includeHidden: true,
          },
          git: {
            requireCleanWorkingTree: true,
          },
          skipGit: false,
          skipNpm: false,
          skipGithub: false,
          isMonorepo: false,
        } as T
      }
    }
  }
  
  const action = new TestAction()
  
  const options = {
    ci: false,
    requireCleanWorkingTree: false,
    releaseCount: 100,
    isMonorepo: true,
    skipNpm: true,
  } as ReleaseCliOptions
  
  const { configFile, config } = await action.createConfig(options)
  
  expect(configFile).toBe('')
  
  expect(config.changelog.releaseCount).toBe(100)
  expect(config.changelog.includeHidden).toBe(true)
  expect(config.git.requireCleanWorkingTree).toBe(false)
  expect(config.skipGit).toBe(false)
  expect(config.skipNpm).toBe(true)
  expect(config.skipGithub).toBe(false)
  expect(config.isMonorepo).toBe(true)
})

it('should parse cli number options', async () => {
  const action = new Action()
  
  const options = {
    ci: false,
    requireCleanWorkingTree: false,
    releaseCount: Number('NaN'),
    isMonorepo: true,
    includeHidden: true,
  } as ReleaseCliOptions
  
  const def = createDefaultConfig(options.ci)
  
  const { configFile, config } = await action.createConfig(options)
  
  expect(configFile).toBe('')
  
  expect(config.changelog.releaseCount).toBe(1)
  expect(config.changelog.includeHidden).toBe(true)
  expect(config.git.requireCleanWorkingTree).toBe(false)
  expect(config.skipGit).toBe(def.skipGit)
  expect(config.skipNpm).toBe(def.skipNpm)
  expect(config.skipGithub).toBe(def.skipGithub)
  expect(config.isMonorepo).toBe(true)
})
