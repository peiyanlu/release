import { getAuthenticatedUser, getPublishedVersion, hasWriteAccess, pingRegistry } from '@peiyanlu/cli-utils'
import { assert } from '@peiyanlu/ts-utils'
import { Project, type ProjectPublishCheckOptions } from '../core/index.js'


export const check = async (project: Project, options: ProjectPublishCheckOptions = {}) => {
  const { logger } = options
  
  logger?.verbose('Checking npm registry...')
  
  const pinged = await pingRegistry()
  assert(pinged, 'Unable to connect to the npm registry')
  
  logger?.verbose('Checking npm authentication...')
  
  const username = await getAuthenticatedUser()
  assert(username, 'Not authenticated with npm')
  
  const name = await project.manifest.getName()
  if (await getPublishedVersion(name)) {
    logger?.verbose(`Checking npm write access for "${ name }"...`)
    
    const hasAccess = await hasWriteAccess(name, username)
    assert(hasAccess, `No write access to npm package "${ name }"`)
  }
}
