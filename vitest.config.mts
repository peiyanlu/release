import { defineConfig, type UserWorkspaceConfig } from 'vitest/config'


const config: UserWorkspaceConfig = defineConfig({
  test: {
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
    },
    projects: [
      {
        extends: true,
        test: {
          name: {
            label: 'scenario',
            color: 'green',
          },
          setupFiles: [],
          include: [ '**/tests/**/*.{test,spec}.{ts,mts}' ],
        },
      },
    ],
  },
})

export default config
