import { DefaultConfig, ReleaseContext } from './types.js'
import { PreId } from './version/prompts.js'


export const createDefaultContext = (): ReleaseContext => {
  return {
    isCI: false,
    release: false,
    showRelease: false,
    showChangelog: false,
    dryRun: false,
    noGit: false,
    noNpm: false,
    noGitHub: false,
    increment: '',
    isIncrement: false,
    configFileExists: false,
    pkg: {
      current: '',
      next: '',
      name: '',
      isPrivate: false,
      fromPreRelease: false,
      toPreRelease: false,
      publishConfig: {
        access: 'public',
        registry: 'https://registry.npmjs.org',
      },
      preId: PreId.BETA,
      preBase: '0',
    },
    npm: {
      username: '',
      otp: '',
      tag: 'latest',
    },
    git: {
      remoteName: 'origin',
      remoteUrl: '',
      latestTag: '',
      previousTag: '',
      currentTag: '',
      isCommitted: false,
      isTagged: false,
      isPushed: false,
      commitMessage: '',
      tagMessage: '',
      tagName: '',
    },
    github: {
      username: '',
      repo: '',
      changelog: '',
      owner: '',
      isWeb: false,
      isReleased: false,
      releaseId: 0,
      releaseUrl: '',
      uploadUrl: '',
      discussionUrl: '',
      token: '',
      releaseName: '',
    },
  } satisfies ReleaseContext
}

export const createDefaultConfig = (isCI?: boolean): DefaultConfig => {
  return {
    hooks: {
      'before:bump': '',
      'after:bump': '',
      'before:publish': '',
      'after:publish': '',
      'before:push': '',
      'after:push': '',
      'before:release': '',
      'after:release': '',
    },
    git: {
      commit: isCI,
      tag: isCI,
      push: isCI,
      commitMessage: 'chore(release): ${version}',
      commitArgs:[],
      tagMessage: 'Release ${version}',
      tagName: '${version}',
      tagArgs:[],
      pushArgs:[],
      addUntrackedFiles: false,
      requireRemote: true,
      requireRepository: true,
      requireWorkDirClean: true,
    },
    npm: {
      publish: isCI,
      publishPath: '.',
      pushArgs: [],
      skipChecks: false,
    },
    github: {
      release: isCI,
      releaseName: 'Release ${version}',
      autoGenerate: false,
      prerelease: false,
      draft: false,
      tokenRef: 'GITHUB_TOKEN',
      assets: [],
      skipChecks: false,
    },
  } satisfies DefaultConfig
}
