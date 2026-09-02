import { defineComponent, h } from 'vue'
import App from './App.vue'
import { bootstrap } from './bootstrap'
import './style.css'

/**
 * The `bootstrap()` function in `./bootstrap.ts` owns the order of
 * side effects (init theme → start perf monitor → mount). Tests for
 * that ordering live next to `bootstrap`; `main.ts` is a one-liner
 * that just wires the production root component in.
 *
 * The tiny `RootApp` wrapper exists so a future migration to a
 * different mount API doesn't have to touch this file.
 */
const RootApp = defineComponent({ render: () => h(App) })
bootstrap(RootApp)
