import { editFile, readJsonFile, writeJsonFile } from '@peiyanlu/node-utils'
import { isEmptyObject, omit, partition, unset } from '@peiyanlu/ts-utils'
import { join } from 'node:path'


type PackageJson = Record<string, any>


// https://pnpm.io/package_json#publishconfig
export const PUBLISH_CONFIG_FIELDS = [
  'bin',
  'main',
  'exports',
  'types',
  'typings',
  'module',
  'browser',
  'esnext',
  'es2015',
  'unpkg',
  'umd:main',
  'typesVersions',
  'cpu',
  'os',
  'engines',
]

export const IGNORE_FIELDS = [
  'babel',
  'browserslist',
  'c8',
  'commitlint',
  'devDependencies',
  'eslintConfig',
  'eslintIgnore',
  'husky',
  'jest',
  'lint-staged',
  'nano-staged',
  'pre-commit',
  'prettier',
  'pwmetrics',
  'remarkConfig',
  'renovate',
  'resolutions',
  'sharec',
  'simple-git-hooks',
  'simple-pre-commit',
  'size-limit',
  'typeCoverage',
  'yaspeller',
  'pnpm',
  'packageManager',
]

export const KEEP_SCRIPT_NAMES = [
  'preinstall',
  'install',
  'postinstall',
]

export const IGNORE_FILES = [
  '.DS_Store',
  '.git',
  '.vscode',
  '.idea',
  'node_modules',
]

// -----------------

export const clearPackageJSON = async (
  dir: string,
  options?: { ignoreFields?: string[]; keepScripts?: string[]; },
): Promise<void> => {
  const file = join(dir, 'package.json')
  const json = await readJsonFile(file)
  const { ignoreFields = [], keepScripts = [] } = options ?? {}
  
  const mergePublishConfig = (json: PackageJson) => {
    if (!json.publishConfig) return json
    
    const publishConfig = { ...json.publishConfig }
    
    PUBLISH_CONFIG_FIELDS.forEach(field => {
      if (publishConfig[field]) {
        json[field] = publishConfig[field]
        delete publishConfig[field]
      }
    })
    
    return { ...json, publishConfig }
  }
  
  const removeIgnoredFields = (json: PackageJson) => {
    const fields = [ ...ignoreFields, ...IGNORE_FIELDS ]
    const [ matched, unmatched ] = partition(fields, i => i.includes('.'))
    
    matched.forEach(field => unset(json, field))
    
    return omit(json, unmatched)
  }
  
  
  const cleanScripts = (json: PackageJson) => {
    if (!json.scripts) return json
    
    const keep = [ ...keepScripts, ...KEEP_SCRIPT_NAMES ]
    const excludes = Object.keys(json.scripts).filter(k => !keep.includes(k))
    json.scripts = omit(json.scripts, excludes)
    
    return json
  }
  
  const removeEmptyObjects = (json: PackageJson) => {
    const excludes = Object.entries(json).filter(([ k, v ]) => isEmptyObject(v))
      .map(([ k, v ]) => k)
    return omit(json, excludes)
  }
  
  const pkg = structuredClone(mergePublishConfig(json))
  const cleaned = removeEmptyObjects(
    cleanScripts(
      removeIgnoredFields(pkg),
    ),
  )
  
  await writeJsonFile(file, cleaned)
}

export const cleanReadme = async (dir: string, homepage: string): Promise<void> => {
  const file = join(dir, 'README.md')
  homepage && await editFile(file, str => {
    return str.split(/^##\s+\S.*$/m)[0] +
      '## Docs\n\n' +
      `Read full docs **[here](${ homepage })**.`
  })
}
