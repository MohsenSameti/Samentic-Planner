/**
 * App bootstrap. Extracted from `main.ts` so the order of
 * side-effects (theme application before Vue mount, perf monitor
 * start before data load) is unit-testable — the no-flash property
 * of the dark theme *requires* that the `data-theme` attribute is on
 * `<html>` before `createApp().mount()` paints, and a regression
 * here would be silent without a test.
 */
import { createApp, type App, type Component } from 'vue'
import { useTheme } from './composables/useTheme'
import { initPerformanceMonitoring } from './utils/performance'

/**
 * Mount the app with the correct order of side effects:
 *
 *   1. `initTheme()` — read the persisted choice from `localStorage`
 *      and apply the resolved theme to `<html data-theme="…">` BEFORE
 *      the first paint. This is the no-flash guarantee.
 *   2. `initPerformanceMonitoring()` — start the page-load timer so
 *      it captures Vue's compile/render work as well as the data
 *      fetch. Has to start before the mount.
 *   3. `createApp(...).mount('#app')` — finally, paint.
 *
 * The `rootComponent` is parameterised so the test can swap in a
 * stub component without depending on the real `App.vue` (which
 * pulls in the full auth/notes/projects graph).
 */
export function bootstrap(rootComponent: Component): ReturnType<App['mount']> {
  useTheme().initTheme()
  initPerformanceMonitoring()
  return createApp(rootComponent).mount('#app')
}
