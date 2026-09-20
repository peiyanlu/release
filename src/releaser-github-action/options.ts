import { getBooleanInput, getInput } from '@actions/core'
import { type Dict, isBoolean } from '@peiyanlu/ts-utils'
import type { ReleaseType } from 'semver'
import type { ReleaserSkipOptions } from '../core/index.js'


const omitEmpty = <T extends object>(object: T) => {
  const result = {} as Partial<T>
  
  for (const [ key, value ] of Object.entries(object)) {
    if (isBoolean(value) || Boolean(value)) {
      result[key as keyof T] = value as T[keyof T]
    }
  }
  
  return result
}

const getOptionalBooleanInput = (name: string) => getInput(name) ? getBooleanInput(name) : undefined

const getOptionalJsonInput = (name: string) => {
  const value = getInput(name)
  
  return value ? JSON.parse(value) as {} : undefined
}


interface InputOptions<T> {
  checkout: Partial<{
    branch: string;
  }>
  bump: Partial<{
    version: string;
    as: ReleaseType;
    prerelease: string;
    snapshot: string;
    firstRelease: boolean;
    skip: boolean;
    /** monorepo bump */
    byProject: T;
  }>
  maintenanceBranch: Partial<{
    enabled: boolean;
  }>
  publish: Partial<{
    skip: boolean;
    /** npm publish */
    access: string;
    tag: string;
  }>
}

export const getInputOptions = <T extends Dict>(): InputOptions<T> => ({
  checkout: omitEmpty({
    branch: getInput('checkout-branch'),
  }),
  bump: omitEmpty({
    version: getInput('bump-version'),
    as: getInput('bump-as') as ReleaseType,
    prerelease: getInput('bump-prerelease'),
    snapshot: getInput('bump-snapshot'),
    firstRelease: getOptionalBooleanInput('bump-first-release'),
    byProject: getOptionalJsonInput('bump-by-project') as T,
  }),
  maintenanceBranch: omitEmpty({
    enabled: getOptionalBooleanInput('maintenance-branch-enabled'),
  }),
  publish: omitEmpty({
    access: getInput('publish-access'),
    tag: getInput('publish-tag'),
  }),
})

export const getInputSkippedSteps = (): ReleaserSkipOptions => ({
  bump: getOptionalBooleanInput('bump-skip'),
  publish: getOptionalBooleanInput('publish-skip'),
})
