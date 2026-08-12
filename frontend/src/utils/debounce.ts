/**
 * Generic debounce helper.
 *
 * Defers calling `func` until `wait` milliseconds have elapsed since the
 * *last* invocation of the returned function. Useful for coalescing rapid
 * keystrokes / slider drags into a single downstream action (e.g. an
 * API call).
 *
 * The returned function is `void`-returning on purpose: by the time the
 * debounced body actually runs, the call site has already returned, so
 * there's nothing meaningful for the caller to `await`. If a caller
 * needs the result of the most recent call, use `useDebounceFn` from
 * `@vueuse/core` inside a component's setup instead — that preserves
 * the wrapped function's return value.
 *
 * Type contract:
 * - The wrapped function's parameters and return value are preserved
 *   via `Parameters<T>`, so TypeScript narrows correctly at call sites.
 * - We type the function shape as `(...args: readonly unknown[]) => unknown`
 *   rather than `any` per the project typing policy.
 */

type AnyFn = (...args: readonly unknown[]) => unknown
type DebouncedFn<T extends AnyFn> = (...args: Parameters<T>) => void

/**
 * Returns a debounced wrapper around `func`. Each call resets the timer
 * — only the *last* set of arguments within `wait` ms will fire `func`.
 *
 * Calling `.flush()` (if exposed via the returned wrapper below is not
 * supported here; use `useDebounceFn` from `@vueuse/core` if you need
 * that) — this minimal implementation is intentionally limited to the
 * core behaviour to keep the surface small.
 */
export function debounce<T extends AnyFn>(func: T, wait: number): DebouncedFn<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return function debounced(...args: Parameters<T>): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      timeoutId = null
      // Non-null assertion: setTimeout above guarantees `timeoutId` is
      // non-null here. We capture into a local to keep the closure tidy.
      func(...args)
    }, wait)
  }
}
