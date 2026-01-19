import { coerce, inc, parse, prerelease, valid } from 'semver'
import { Release } from './prompts.js'


export const isPreRelease = (version: string) => {
  return Boolean(prerelease(version))
}

export const isValid = (version: string) => {
  return Boolean(valid(version))
}

export const parseVersion = (raw: string) => {
  const next = isValid(raw) ? raw : coerce(raw)?.toString()
  if (!next) return {}
  
  const { prerelease } = parse(next)!
  const toPreRelease = Boolean(prerelease.length)
  const [ preId, preBase ] = prerelease.map(String)
  
  return { next, toPreRelease, preId, preBase }
}

export const getCIVersion = (current: string) => {
  return inc(current, Release.PATCH) ?? ''
}
