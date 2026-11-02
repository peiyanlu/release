import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'


process.traceProcessWarnings = true


const __dirname = dirname(fileURLToPath(import.meta.url))
const isWin = 'win32' === process.platform


const projectDir = process.cwd()
const actionDir = __dirname
// 是否是项目自身
const isSelf = projectDir === actionDir


console.log(`Project at: ${ projectDir }`)
console.log(`Action at: ${ actionDir }`)


const run = (command, args, options = {}, title) => {
  const fullCmd = `${ command } ${ args.join(' ') }`.trim()
  
  console.log(`::group::${ title ?? fullCmd }`)
  const { error, status = 1, signal } = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  })
  console.log('::endgroup::')
  
  if (error) {
    console.error(`Failed to start "${ command }": ${ error.message }`)
  }
  
  if (status !== 0) {
    const reason = signal ? `(terminated by ${ signal })` : ''
    console.error(`"${ fullCmd }" failed with exit code ${ status } ${ reason }`)
    process.exit(status)
  }
}


const buildAction = (cwd = actionDir) => {
  const options = { shell: isWin, cwd }
  
  run('corepack', [ 'enable' ], options, 'Enable corepack')
  run('pnpm', [ 'install', '--frozen-lockfile' ], options, 'Install deps')
  run('pnpm', [ 'exec', 'tsdown' ], options, 'Build action')
}

const installReleaseDep = (cwd = projectDir) => {
  const options = { shell: isWin, cwd }
  
  if (!isSelf) {
    run('pnpm', [ 'add', '@peiyanlu/release' ],options, 'Install @peiyanlu/release globally')
  }
}

const runAction = (cwd = projectDir) => {
  /** `shell: true` 会导致带连字符的变量（例如：`INPUT_GITHUB-TOKEN`）不能传递到子进程 */
  const disableShellOptions = { shell: false, cwd }
  
  run('node', [ join(actionDir, 'dist', 'action.mjs') ], disableShellOptions, 'Run release action')
}


buildAction()

installReleaseDep()

runAction()
