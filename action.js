import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'


process.traceProcessWarnings = true


const __dirname = dirname(fileURLToPath(import.meta.url))
const isWin = 'win32' === process.platform


const projectDir = process.cwd()
const actionDir = __dirname

// 是否是项目自身
const homologous = projectDir === actionDir

console.log(`Project at: ${ projectDir }`)
console.log(`Action at: ${ actionDir }`)


const run = (command, args, options = {}) => {
  const { error, status, signal } = spawnSync(command, args, {
    stdio: 'inherit',
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
  
  console.log('Starting build action...')
  
  run('corepack', [ 'enable' ], options)
  run('pnpm', [ 'install', '--frozen-lockfile' ], options)
  run('pnpm', [ 'exec', 'tsdown' ], options)
}

const installReleaseDep = (cwd = projectDir) => {
  const options = { shell: isWin, cwd }
  
  if (!homologous) {
    console.log('Installing release dep...')
    run('pnpm', [ 'add', '-g', '@peiyanlu/release' ], options)
  }
}

const runAction = (cwd = projectDir) => {
  /** `shell: true` 会导致带连字符的变量（例如：`INPUT_GITHUB-TOKEN`）不能传递到子进程 */
  const noShellOptions = { shell: false, cwd }
  
  console.log('Starting release project...')
  
  run('node', [ join(actionDir, 'dist', 'action.mjs') ], noShellOptions)
}


buildAction()

installReleaseDep()

runAction()
