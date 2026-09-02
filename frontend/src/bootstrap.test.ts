/**
 * Tests for the `bootstrap()` function.
 *
 * The whole point of `bootstrap()` is to make the order of
 * side-effects testable. The no-flash property of the dark theme
 * REQUIRES that `<html data-theme="…">` be set before Vue mounts —
 * otherwise a user with `localStorage = 'dark'` would see a flash
 * of the light theme on every reload. A regression here is silent
 * (the app still works, just with a flash), so we lock it down
 * with this test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, type Component } from 'vue'

/**
 * Spy on `useTheme().initTheme` so we can observe its call order.
 * The real composable is too side-effect-heavy to run in this test
 * (it touches `localStorage`, `matchMedia`, and the DOM), so we
 * mock the whole module and expose an `initSpy` we can assert on.
 */
const initSpy = vi.fn()

vi.mock('./composables/useTheme.js', () => ({
  useTheme: () => ({
    theme: { value: 'system' },
    resolvedTheme: { value: 'light' },
    initTheme: initSpy,
    setTheme: vi.fn(),
  }),
}))

/**
 * `initPerformanceMonitoring` is also a side-effecting module; mock
 * it for the same reason. The test just needs to know it ran.
 */
vi.mock('./utils/performance.js', () => ({
  initPerformanceMonitoring: vi.fn(),
}))

/**
 * Mock `createApp` to capture the order in which `initTheme`,
 * `initPerformanceMonitoring`, and `mount` were called. We can't
 * actually mount Vue into happy-dom's body in this test (we'd
 * pull in the full `App.vue` graph), so we stub the chain to
 * return a sentinel and let the test inspect the recorded order.
 */
const mountSpy = vi.fn<(el: string) => unknown>()
const createAppSpy = vi.fn<(...args: unknown[]) => { mount: typeof mountSpy }>(() => ({ mount: mountSpy }))

vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue')>()
  return {
    ...actual,
    createApp: (...args: [Component, ...unknown[]]) => {
      // Delegate to the spy so we can assert on the call, but also
      // build a real `mount` shape so the rest of the call chain
      // doesn't blow up.
      createAppSpy(...args)
      return { mount: mountSpy as unknown as (el: string) => unknown }
    },
  }
})

describe('bootstrap', () => {
  beforeEach(() => {
    initSpy.mockClear()
    mountSpy.mockClear()
    createAppSpy.mockClear()
    document.documentElement.removeAttribute('data-theme')
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.removeAttribute('data-theme')
    localStorage.clear()
  })

  it('calls initTheme before createApp().mount()', async () => {
    const { bootstrap } = await import('./bootstrap.js')
    const Stub = defineComponent({ render: () => h('div') })
    bootstrap(Stub)
    await nextTick()

    expect(initSpy).toHaveBeenCalledTimes(1)
    expect(createAppSpy).toHaveBeenCalledTimes(1)
    expect(mountSpy).toHaveBeenCalledTimes(1)

    // Order check: the relative call order between the three spies
    // is the property we care about. `initTheme` must precede
    // `mount`; the createApp step is intermediate.
    const initOrder = initSpy.mock.invocationCallOrder[0]
    const createOrder = createAppSpy.mock.invocationCallOrder[0]
    const mountOrder = mountSpy.mock.invocationCallOrder[0]
    expect(initOrder).toBeLessThan(createOrder)
    expect(createOrder).toBeLessThan(mountOrder)
  })

  it('mounts into the #app element', async () => {
    const { bootstrap } = await import('./bootstrap.js')
    const Stub = defineComponent({ render: () => h('div') })
    bootstrap(Stub)
    await nextTick()

    expect(mountSpy).toHaveBeenCalledWith('#app')
  })
})
