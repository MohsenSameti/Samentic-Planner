/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * Vitest configuration for the frontend.
 *
 * `happy-dom` provides a lightweight DOM for component tests — much
 * faster than `jsdom` and good enough for our component contracts
 * (event listeners, refs, basic CSS-class assertions).
 *
 * `@vitejs/plugin-vue` is required so `.vue` SFCs are processed the
 * same way as in dev/build.
 *
 * `globals: true` is deliberately OFF — every test file imports the
 * `describe/it/expect/vi` symbols it needs. This keeps the test
 * surface explicit and avoids accidental global collisions.
 *
 * `env.TZ = 'UTC'` is critical: the `useWeekNavigation` composable
 * converts local `Date` to an ISO string (`toISOString().split('T')[0]`)
 * to derive the week's start. In a non-UTC test environment, local
 * midnight can fall on the previous UTC day, breaking date-based
 * assertions. Pinning to UTC keeps date arithmetic deterministic.
 */
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    env: {
      TZ: 'UTC',
    },
    include: ['src/**/*.{test,spec}.ts'],
    // Run `src/test/setup.ts` before each file so a clean Pinia-less
    // global state is available.
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: [
        'src/**/*.{test,spec}.ts',
        'src/main.ts',
        // Vite-injected env shim — pure type information.
        'src/vite-env.d.ts',
        // Type-only modules.
        'src/types/**',
      ],
      reporter: ['text', 'text-summary', 'html'],
    },
  },
})
