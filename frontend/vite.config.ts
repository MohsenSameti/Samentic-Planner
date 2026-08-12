import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    /**
     * Manual chunking strategy.
     *
     * Vite/Rollup figures out splitting automatically based on the
     * dynamic-import graph (`defineAsyncComponent` calls in `App.vue`),
     * but we want a few explicit control points:
     *
     * - `vendor` — `vue` and friends plus VueUse. Splitting these off
     *   means upgrades can re-use a long-cached vendor chunk while the
     *   app's own code changes.
     * - `modals` — collects every `modals/*.vue` into a single chunk
     *   so `defineAsyncComponent(() => import('../modals/TaskModal.vue'))`
     *   references a stable URL.
     *
     * Sub-trees referenced only from modal components (form fields,
     * icons, etc.) are pulled into the modal chunk by Rollup's
     * automatic splitting; we don't need to list them here.
     */
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor chunk: anything shipped by `node_modules` that we
          // explicitly want separated from app code. Includes Vue
          // itself plus the @vueuse utilities.
          if (id.includes('node_modules')) {
            // Pinia / vue-router are not currently dependencies, but
            // future-proofing this branch costs nothing.
            if (
              id.includes('vue') ||
              id.includes('@vueuse') ||
              id.includes('pinia')
            ) {
              return 'vendor'
            }
          }
          // All modal components go into the same chunk so they're
          // loaded together the first time one of them opens.
          if (id.includes('/src/modals/') && id.endsWith('.vue')) {
            return 'modals'
          }
        }
      }
    }
  }
})
