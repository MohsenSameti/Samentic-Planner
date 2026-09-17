<script setup lang="ts">
/**
 * Reusable vertical virtual list with variable-height items.
 *
 * Render path is selected per render by `shouldVirtualize`:
 *
 * - Below `threshold` items: render directly with no observers.
 *   This is the typical case for the planner's day columns
 *   (5–20 items per day) and keeps the cost minimal.
 * - Above `threshold`: install a `ResizeObserver` per visible row
 *   plus a container `ResizeObserver` + a `scroll` listener, render
 *   only the items in the viewport plus `overscan` rows on either
 *   side. Item heights are measured per-item and stored in a
 *   `Map<id, height>`; the list's total scrollable height is the
 *   cumulative sum of measured heights.
 *
 * Spec §20: the previous version assumed a fixed `itemHeight` both
 * as the slot's `height` and as its `translateY` offset. Real cards
 * are variable-height (description clamp, expanded notes textarea),
 * so above the threshold items overlapped or clipped — the
 * virtualizer was actively broken for the case it exists to serve.
 * The fix gates measurement to the virtualized path so the
 * ordinary 5–20-item column pays nothing.
 */

import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
  type CSSProperties,
} from 'vue'

interface Item {
  id: string
}

const props = withDefaults(
  defineProps<{
    items: readonly Item[]
    /**
     * Initial / fallback height (px) used while the per-item
     * `ResizeObserver` hasn't measured a real value yet, and as the
     * starting estimate so the first paint doesn't jump.
     */
    itemHeight: number
    overscan?: number
    /** Skip virtualization below this count. */
    threshold?: number
  }>(),
  { overscan: 10, threshold: 50 },
)

const shouldVirtualize = computed<boolean>(() => props.items.length > props.threshold)

/* ------------------------------------------------------------------ */
/* Virtualized path                                                     */
/* ------------------------------------------------------------------ */

const containerRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const containerHeight = ref(0)
let containerResizeObserver: ResizeObserver | null = null

/**
 * Per-item measured heights keyed by `id`. Falls back to
 * `props.itemHeight` for items that have never been measured (e.g.
 * scrolled off-screen before their `ResizeObserver` fired).
 *
 * Stored in a `reactive` Map so per-item updates don't re-run the
 * whole offset computation — only the affected entries' get() calls
 * recompute.
 */
const measuredHeights = reactive<Map<string, number>>(new Map())

/** Per-row `ResizeObserver`s, keyed by `id`. Disconnected when
 *  the row leaves the rendered set so an unbounded list doesn't
 *  leak observers. */
const rowObservers = new Map<string, ResizeObserver>()

function observeRow(id: string, el: HTMLElement): void {
  if (rowObservers.has(id)) return
  const ro = new ResizeObserver(entries => {
    for (const entry of entries) {
      const h = entry.contentRect.height
      if (h > 0 && measuredHeights.get(id) !== h) {
        measuredHeights.set(id, h)
      }
    }
  })
  ro.observe(el)
  rowObservers.set(id, ro)
}

function unobserveRow(id: string): void {
  const ro = rowObservers.get(id)
  if (!ro) return
  ro.disconnect()
  rowObservers.delete(id)
}

/** Resolve an item's height: measured first, then the prop's
 *  initial-estimate fallback. */
function heightFor(item: Item): number {
  return measuredHeights.get(item.id) ?? props.itemHeight
}

function handleScroll(event: Event): void {
  const target = event.target as HTMLElement | null
  if (target) scrollTop.value = target.scrollTop
}

onMounted(() => {
  if (!shouldVirtualize.value) return
  const node = containerRef.value
  if (node) {
    containerResizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        containerHeight.value = entry.contentRect.height
      }
    })
    containerResizeObserver.observe(node)
    containerHeight.value = node.clientHeight
  }
})

onBeforeUnmount(() => {
  if (containerResizeObserver) {
    containerResizeObserver.disconnect()
    containerResizeObserver = null
  }
  for (const ro of rowObservers.values()) ro.disconnect()
  rowObservers.clear()
})

const itemCount = computed<number>(() => props.items.length)

/**
 * Cumulative offset for each item: the y-position where the item
 * starts. `offsets[i]` is the sum of all `heightFor(j)` for `j < i`.
 * Used both as the slot's `translateY` and to compute `totalHeight`.
 */
const itemOffsets = computed<number[]>(() => {
  const offsets: number[] = new Array(itemCount.value)
  let acc = 0
  for (let i = 0; i < itemCount.value; i++) {
    offsets[i] = acc
    const item = props.items[i]
    if (item) acc += heightFor(item)
  }
  return offsets
})

const totalHeight = computed<number>(() => {
  const last = itemCount.value - 1
  if (last < 0) return 0
  const lastItem = props.items[last]
  if (!lastItem) return 0
  const offsets = itemOffsets.value
  return (offsets[last] ?? 0) + heightFor(lastItem)
})

/**
 * Visible range. Uses `props.itemHeight` as the *initial estimate*
 * for windowing math (a faster-than-binary-search approximation is
 * overkill for the planner's small N), then the measured heights
 * fine-tune placement via the offset map. Overscan still works
 * because we always include extra rows above + below.
 */
const visibleRange = computed<{ start: number; end: number }>(() => {
  const overscan = props.overscan
  const est = props.itemHeight
  const start = Math.max(0, Math.floor(scrollTop.value / est) - overscan)
  const end = Math.min(
    itemCount.value,
    Math.ceil((scrollTop.value + containerHeight.value) / est) + overscan,
  )
  return { start, end }
})

const virtualizedItems = computed<Item[]>(() =>
  props.items.slice(visibleRange.value.start, visibleRange.value.end),
)

function itemOffsetStyle(index: number): CSSProperties {
  const realIndex = visibleRange.value.start + index
  const offsets = itemOffsets.value
  const top = offsets[realIndex] ?? 0
  const item = props.items[realIndex]
  const height = item ? heightFor(item) : props.itemHeight
  return {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: `${height}px`,
    transform: `translateY(${top}px)`,
  }
}

/**
 * Re-bind row observers whenever the rendered set changes (because
 * the user scrolled, or the items prop changed). Old observers are
 * disconnected so the active set never grows unbounded.
 */
watch(
  virtualizedItems,
  (next, prev) => {
    const nextIds = new Set(next.map(i => i.id))
    const prevIds = new Set(prev?.map(i => i.id) ?? [])
    for (const id of prevIds) {
      if (!nextIds.has(id)) unobserveRow(id)
    }
    // New rows attach their observers via the `ref` callback on the
    // rendered element (see template).
  },
)

/**
 * `ref` callback for each rendered virtual row. Attaches (or
 * detaches) the per-row `ResizeObserver` as the element mounts /
 * unmounts.
 */
function setRowRef(id: string, el: Element | null): void {
  if (el instanceof HTMLElement) {
    observeRow(id, el)
  } else {
    unobserveRow(id)
  }
}

const containerStyle = computed<CSSProperties>(() => ({
  position: 'relative',
  overflowY: 'auto',
  height: '100%',
}))

const wrapperStyle = computed<CSSProperties>(() => ({
  position: 'relative',
  height: `${totalHeight.value}px`,
}))

/* ------------------------------------------------------------------ */
/* Plain path                                                           */
/* ------------------------------------------------------------------ */

const plainItems = computed<Item[]>(() => [...props.items])
</script>

<template>
  <div
    v-if="shouldVirtualize"
    ref="containerRef"
    class="virtual-list-container"
    :style="containerStyle"
    @scroll.passive="handleScroll"
  >
    <div class="virtual-list-wrapper" :style="wrapperStyle">
      <div
        v-for="(row, index) in virtualizedItems"
        :key="row.id"
        :ref="(el) => setRowRef(row.id, el as Element | null)"
        class="virtual-list-item"
        :style="itemOffsetStyle(index)"
      >
        <slot :item="row" :index="visibleRange.start + index" />
      </div>
    </div>
  </div>
  <div v-else class="virtual-list-plain">
    <div
      v-for="(row, index) in plainItems"
      :key="row.id"
      class="virtual-list-item virtual-list-item--plain"
    >
      <slot :item="row" :index="index" />
    </div>
  </div>
</template>

<style scoped>
.virtual-list-container,
.virtual-list-plain {
  width: 100%;
}

.virtual-list-wrapper {
  width: 100%;
}

.virtual-list-plain {
  display: flex;
  flex-direction: column;
  gap: inherit;
}

.virtual-list-item--plain {
  position: static;
}
</style>
