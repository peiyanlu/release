import type { ChildLogger } from '../logger.js'
import type { Project } from '../project/project.js'


export interface ReleaseData {
  version: string
  title: string
  notes: string
  previousTag: string
  nextTag: string
  isPrerelease: boolean
  isLatest: boolean
}

export interface CreateReleaseOptions {
  project: Project
  dryRun?: boolean
  logger?: ChildLogger
  skip?: boolean
}

export interface CreatePullRequestOptions {
  project: Project
  to?: string
  from?: string
  dryRun?: boolean
  logger?: ChildLogger
}

export interface ReleaseCheckOptions {
  logger?: ChildLogger
  skip?: boolean
}
