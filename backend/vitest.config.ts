import { defineConfig } from 'vitest/config'

/**
 * Vitest configuration for the backend.
 *
 * The backend has no DOM, so we use the `node` environment. Files
 * matching `*.test.ts` are treated as tests; SFC/coverage settings
 * are intentionally absent since the backend is pure TypeScript.
 *
 * Coverage is opt-in via `pnpm test:coverage` — the report uses the
 * v8 provider for fast, accurate branch coverage.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Each test file gets a fresh module graph so the singleton
    // `store` export doesn't bleed state between files. Tests that
    // need the singleton should import it explicitly.
    isolate: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/types.ts',
        // Test-only helpers and entry points; coverage is noise.
        'src/index.ts',
      ],
      reporter: ['text', 'text-summary', 'html'],
    },
  },
})
