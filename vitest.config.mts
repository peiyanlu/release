import { defineConfig } from 'vitest/config'


const config: ReturnType<typeof defineConfig> = defineConfig({
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
