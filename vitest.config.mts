import { defineConfig } from 'vitest/config'


export default defineConfig({
  test: {
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
    },
    projects: [
      {
        test: {
          name: {
            label: 'scenario',
            color: 'green',
          },
          setupFiles: [ './tests/setup.ts' ],
          include: [ '**/tests/**/*.{test,spec}.{ts,mts}' ],
        },
      },
    ],
  },
})
