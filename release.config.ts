import { defineConfig, GithubHosting, PnpmProject, type UserConfig } from '@peiyanlu/release'


const config: UserConfig<PnpmProject, GithubHosting> = defineConfig({
  project: new PnpmProject(),
  hosting: new GithubHosting(),
  releaser: {
    verbose: true,
  },
})

export default config
