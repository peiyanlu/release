import { newline } from '@conventional-changelog/template'
import { normalizePath } from '@peiyanlu/node-utils'
import { dedent, isEmpty } from '@peiyanlu/ts-utils'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { globSync } from 'tinyglobby'
import { parse } from 'yaml'


export const scanWorkspacePackages = (cwd: string) => {
  const workspaceFile = join(cwd, 'pnpm-workspace.yaml')
  
  if (!existsSync(workspaceFile)) {
    return []
  }
  
  const { packages = [] } = parse(readFileSync(workspaceFile, 'utf8'))
  
  return globSync(
    packages.map((pattern: string) => normalizePath(join(pattern, 'package.json'))),
    {
      cwd: cwd,
      absolute: false,
    },
  )
}

export const getPackages = (cwd: string) => {
  const matched = scanWorkspacePackages(cwd)
  return matched.reduce<Record<string, string[]>>(((acc, file) => {
    const workspace = dirname(dirname(file));
    (acc[workspace] ??= []).push(basename(dirname(file)))
    return acc
  }), {})
}

export const monoConfig = (packages: string[] = [], workspace: string = 'packages'): string => {
  const subs = isEmpty(packages) ? '[]' : `[ ${ [ ...packages ].map(k => `'${ k }'`).join(', ') } ]`
  return dedent(`
    import { defineConfig } from '@peiyanlu/release'
    ${ newline(1) }
    export default defineConfig({
      isMonorepo: true,
      packages: ${ subs },
      getPkgDir: (pkg) => \`${ workspace }/\${ pkg }\`,
      toTag: (pkg, version) => \`\${ pkg }@\${ version }\`,
      changelog: {
        tagPrefix: (pkg) => \`\${ pkg }@\`,
      },
    })
  `)
}

export const generateMonoConfig = (cwd = process.cwd()) => {
  const entries = Object.entries(getPackages(cwd))
  
  const [ workspace, packages ] = entries.length === 1 ? entries[0] : []
  return monoConfig(packages, workspace)
}
