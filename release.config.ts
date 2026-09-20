import { defineConfig, GithubHosting, PnpmProject } from '@peiyanlu/release'


export default defineConfig({
  project: new PnpmProject(),
  hosting: new GithubHosting(),
  releaser: {
    verbose: true,
  },
})
