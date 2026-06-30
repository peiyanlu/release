import { dim, green, underline, yellow } from 'ansis'


const n = (b: boolean) => b ? '(dry run)' : ''

const t = () => green(`${ Math.floor(process.uptime()) }s`)

export const MSG = {
  INTRO: (dryRun: boolean) => `🚀  Starting release ${ n(dryRun) }`,
  INTRO_PREPARE: (dryRun: boolean) => `🚀  Starting prepare release ${ n(dryRun) }`,
  
  OUTRO: (dryRun: boolean) => `🎉  Release finished successfully in ${ t() } ${ n(dryRun) }`,
  OUTRO_PREPARE: (dryRun: boolean) => `🎉  Prepare release finished successfully in ${ t() } ${ n(dryRun) }`,
  
  LOG: {
    SHOW_VERSION: (version: string) => `🎉  Released ${ green(version) }`,
    SHOW_CHANGELOG: '🎉  Changelog collected',
    CHANGELOG_EMPTY: 'No commits found since last release',
    CHANGES_EMPTY: 'Working tree clean. No files changed',
  },
  
  CHECK: {
    GIT: {
      CHECKING: 'Checking Git repository',
      CHECKED: (name: string, url: string) =>
        `Git remote resolved: ${ url ? `${ dim(name) } → ${ underline(dim(url)) }` : 'not found' }`,
    },
    
    NPM: {
      CHECKING: 'Checking npm registry',
      CHECKED: (registry: string, msg: string) =>
        `NPM registry: ${ underline(dim(registry)) } ${ underline(dim(msg)) }`,
    },
    
    GITHUB: {
      CHECKING: 'Checking github repository',
      CHECKED: (repository: string, msg: string) =>
        `GitHub repository: ${ underline(dim(repository)) } ${ underline(dim(msg)) }`,
    },
  },
  
  TASK: {
    VERSION: {
      START: 'Bumping version',
      END: (to: string) => `Version bumped: ${ underline(dim(to)) }`,
    },
    
    CHANGELOG: {
      START: 'Generating changelog',
      END: `Changelog generated`,
    },
    
    NPM: {
      START: 'Publishing npm package',
      END: (url?: string) => url
        ? `Published npm package: ${ underline(dim(url)) }`
        : 'NPM publish skipped',
    },
    
    GIT: {
      START: 'Creating git commit, tag & push',
      END: (push: boolean) => push
        ? 'Git commit, tag & push completed'
        : 'Git commit, tag & push skipped',
    },
    
    GITHUB: {
      START: 'Creating GitHub release',
      END: (url?: string) => url
        ? `Created GitHub release: ${ underline(dim(url)) }`
        : 'GitHub release skipped',
    },
  },
  
  PROMPT: {
    SELECT_PACKAGE: 'Select package release:',
    SELECT_VERSION: 'Select version bump:',
    INPUT_VERSION: 'Enter custom version:',
    NPM_PUBLISH: (pkg: string) => `Publish to npm ${ underline(dim`(${ pkg })`) }?`,
    NPM_OTP: 'Enter npm one-time password (OTP):',
    GITHUB_RELEASE: (title: string) => `Create a new GitHub release ${ underline(dim`(${ title })`) }?`,
    GIT_COMMIT: (msg: string) => `Create git commit ${ underline(dim`(${ msg })`) }?`,
    GIT_TAG: (msg: string) => `Create git tag ${ underline(dim`(${ msg })`) }?`,
    GIT_PUSH: 'Push commits and tags to remote?',
  },
  
  ERROR: {
    GIT_WORKDIR: `[git] Working tree must be clean`,
    GIT_REGISTRY: (name: string) => `[git] Repository not found for ${ dim(name) }`,
    GIT_REMOTE: (name: string) => `[git] Remote "${ dim(name) }" not found`,
    
    GITHUB_TAG_EXIT: (tag: string) => `[github] Release for tag "${ tag }" already exists and is not a draft`,
    GITHUB_TOKEN: (tokenRef: string) => `[github] Missing GitHub token. Please set ${ yellow(tokenRef ?? 'GITHUB_TOKEN') }`,
    GITHUB_AUTH: '[github] Invalid GitHub token or insufficient permissions',
    GITHUB_USER: '[github] User does not have permission to create releases',
    
    NPM_REGISTRY: (registry: string) => `[npm] Unable to reach npm registry ${ underline(dim(registry)) }`,
    NPM_AUTH: `[npm] Not authenticated with npm. Please run ${ yellow('npm login') } and try again`,
    NPM_PERMISSION: `[npm] Missing publish permission. Please use a token with publish access and try again`,
    NPM_USER: (user: string, name: string) => `[npm] User ${ dim(user) } is not a collaborator of ${ dim(name) }`,
  },
  
  ABORT: {
    CANCEL: 'Operation cancelled',
    MONOREPO_CI_NO_PACKAGE: 'CI mode requires a target package in monorepo. Please specify it via "--package <pkg>"',
    MONOREPO_NO_PACKAGES: 'Monorepo detected, but no packages found. Please configure "config.packages"',
  },
  
  INFO: {
    TOOL: (name: string, version: string) => `${ name } ${ dim(`v${ version }`) }`,
    CONFIG: (path: string) => `config file: ${ underline(dim(path || 'not found')) }`,
  },
}
