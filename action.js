import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'


process.traceProcessWarnings = true


const __dirname = dirname(fileURLToPath(import.meta.url))
const isWin = 'win32' === process.platform


const projectDir = process.cwd()
const actionDir = __dirname

console.log(`Project at: ${ projectDir }`)
console.log(`Action at: ${ actionDir }`)


const run = (command, args, options = {}) => {
  const { error, status, signal } = spawnSync(command, args, {
    cwd: actionDir,
    stdio: 'inherit',
    env: { ...process.env },
    ...options,
  })
  
  if (error) {
    console.error(`Failed to start "${ command }": ${ error.message }`)
  }
  
  if (status !== 0) {
    const reason = signal ? `(terminated by ${ signal })` : ''
    console.error(`"${ command } ${ args.join(' ') }" failed with exit code ${ status } ${ reason }`)
    process.exit(status)
  }
}


const buildAction = (cwd = actionDir) => {
  const options = { shell: isWin, cwd }
  
  run('corepack', [ 'enable' ], options)
  run('pnpm', [ 'install', '--frozen-lockfile' ], options)
  run('pnpm', [ 'exec', 'tsdown' ], options)
}

const runAction = (cwd = projectDir) => {
  run('node', [ join(actionDir, 'dist', 'action.mjs') ], { shell: false, cwd })
}


buildAction()

runAction()
