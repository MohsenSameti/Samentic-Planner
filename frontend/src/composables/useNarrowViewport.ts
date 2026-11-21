/**
 * `useNarrowViewport` — reactive "is the viewport narrow?" flag.
 *
 * Tracks a `(max-width: Npx)` media query (default 480px, the
 * phone-sized range) so components can swap layout details when the
 * user is on a phone — e.g. the Jalali date picker switches its
 * weekday header to compact abbreviations and a smaller font at this
 * range.
 *
 * Returns:
 * - `isNarrow`: a `Ref<boolean>` — `true` while the media query
 *   matches. Starts from the current match state and updates on the
 *   `change` event (viewport resizes that cross the breakpoint).
 *
 * Environments without `window.matchMedia` (very old browsers,
 * certain test sandboxes) fall back to `false` (wide layout) and
 * subscribe to nothing — the same guard shape `useTheme` uses.
 * The listener is removed via `onScopeDispose` when the owning
 * component unmounts, so no cross-instance leaks.
 */
import { onScopeDispose, ref, type Ref } from 'vue'

/**
 * Read the current match state of the query. Guarded so SSR / test
 * environments without `matchMedia` resolve to `false` (wide).
 */
function readMatches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia(query).matches
}

export interface UseNarrowViewportReturn {
  isNarrow: Ref<boolean>
}

/**
 * Subscribe to `(max-width: ${maxWidth}px)` and expose it reactively.
 * `maxWidth` defaults to 480 — the breakpoint the Jalali picker uses
 * for its compact weekday labels.
 */
export function useNarrowViewport(maxWidth = 480): UseNarrowViewportReturn {
  const query = `(max-width: ${maxWidth}px)`
  const isNarrow = ref<boolean>(readMatches(query))

  let mediaQuery: MediaQueryList | null = null
  let listener: ((event: MediaQueryListEvent) => void) | null = null

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    mediaQuery = window.matchMedia(query)
    listener = (): void => {
      // Re-read through the MediaQueryList (not the event object) so
      // the source of truth stays the browser's match state.
      isNarrow.value = mediaQuery?.matches ?? false
    }
    mediaQuery.addEventListener('change', listener)
  }

  onScopeDispose(() => {
    if (mediaQuery && listener) {
      mediaQuery.removeEventListener('change', listener)
    }
    mediaQuery = null
    listener = null
  })

  return { isNarrow }
}
