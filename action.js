import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'


const __dirname = dirname(fileURLToPath(import.meta.url))
const actionDir = process.env.GITHUB_ACTION_PATH || __dirname


const run = (command, args, options = {}) => {
  const { error, status, signal } = spawnSync(command, args, {
    cwd: actionDir,
    stdio: 'inherit',
    shell: true,
    env: process.env,
    ...options,
  })
  
  if (error) {
    console.error(`Failed to start ${ command }: ${ error.message }`)
  }
  
  if (status !== 0) {
    const reason = signal ? `(terminated by ${ signal })` : ''
    console.error(`"${ command } ${ args.join(' ') }" failed with exit code ${ status } ${ reason }`)
    process.exit(status)
  }
}


run('corepack', [ 'enable' ])

run('pnpm', [ 'install', '--frozen-lockfile' ])

run('pnpm', [ 'exec', 'tsdown' ])

console.log(
  'INPUT keys:',
  Object.keys(process.env).filter((key) => key.startsWith('INPUT_')),
)

run('node', [ join(actionDir, 'dist', 'action.mjs') ])
