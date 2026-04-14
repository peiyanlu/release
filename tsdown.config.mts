import { defineConfig, type UserConfig } from 'tsdown'


const config: UserConfig[] = defineConfig([
  {
    entry: [ 'src/cli.ts' ],
    format: 'esm',
    outDir: 'dist',
    platform: 'node',
    nodeProtocol: true,
    shims: true,
    dts: false,
  },
  {
    entry: [ 'src/release.ts' ],
    format: 'esm',
    outDir: '.',
    platform: 'node',
    nodeProtocol: true,
    shims: true,
    dts: false,
    clean: false,
    deps: {
      alwaysBundle: [ '@actions/github', '@actions/core' ],
    },
    minify: true,
  },
  {
    entry: [ 'src/index.ts' ],
    format: [ 'esm' ],
    outDir: 'dist',
    platform: 'node',
    nodeProtocol: true,
    shims: true,
    dts: true,
  },
] satisfies UserConfig[])

export default config
