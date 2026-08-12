<script setup lang="ts">
/**
 * Reusable vertical virtual list.
 *
 * Render path is selected per render by `shouldVirtualize`:
 *
 * - Below `threshold` items: render directly with no observers.
 *   This is the typical case for the planner's day columns
 *   (5–20 items per day) and keeps the cost minimal.
 * - Above `threshold`: install a `ResizeObserver` and a `scroll`
 *   listener, render only the items in the viewport plus
 *   `overscan` rows on either side, and use absolute positioning
 *   on a wrapper that's tall enough to drive the scrollbar.
 *
 * We avoid `@vueuse/core`'s `useVirtualList` here because its
 * public types claim to accept `MaybeRef` for both `list` and
 * `options` but its runtime impl actually consumes plain values;
 * wiring reactive sources through it produced drift between
 * type-checking and runtime behaviour. The 30-line virtualizer
 * below is fully reactive and easier to type-check.
 */

import { computed, ref, onMounted, onBeforeUnmount, type CSSProperties } from 'vue'

interface Item { id: string }

const props = withDefaults(
  defineProps<{
    items: readonly Item[]
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
let resizeObserver: ResizeObserver | null = null

function handleScroll(event: Event): void {
  const target = event.target as HTMLElement | null
  if (target) scrollTop.value = target.scrollTop
}

onMounted(() => {
  if (!shouldVirtualize.value) return
  const node = containerRef.value
  if (node) {
    resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        containerHeight.value = entry.contentRect.height
      }
    })
    resizeObserver.observe(node)
    containerHeight.value = node.clientHeight
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

const itemCount = computed<number>(() => props.items.length)
const totalHeight = computed<number>(() => itemCount.value * props.itemHeight)

const visibleRange = computed<{ start: number; end: number }>(() => {
  const overscan = props.overscan
  const start = Math.max(
    0,
    Math.floor(scrollTop.value / props.itemHeight) - overscan,
  )
  const end = Math.min(
    itemCount.value,
    Math.ceil((scrollTop.value + containerHeight.value) / props.itemHeight) + overscan,
  )
  return { start, end }
})

const virtualizedItems = computed<Item[]>(() =>
  props.items.slice(visibleRange.value.start, visibleRange.value.end),
)

function itemOffsetStyle(index: number): CSSProperties {
  const realIndex = visibleRange.value.start + index
  return {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: `${props.itemHeight}px`,
    transform: `translateY(${realIndex * props.itemHeight}px)`,
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
