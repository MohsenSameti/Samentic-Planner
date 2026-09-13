/**
 * Tests for the `VirtualList` component (spec §20).
 *
 * §20 changed `VirtualList` from a fixed-height assumption (broken
 * for variable-height task cards) to a measured-height system: each
 * rendered row reports its real height via a `ResizeObserver`, and
 * the list's scrollable height is the cumulative sum of measured
 * heights.
 *
 * happy-dom doesn't fire `ResizeObserver` callbacks spontaneously,
 * so these tests stub the observer and trigger entries manually. The
 * plain (non-virtualized) path stays unchanged; a few sanity tests
 * pin that to avoid regressing the ordinary 5–20-item day column.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import VirtualList from './VirtualList.vue'

interface RowItem {
  id: string
  /** Simulated measured height in pixels. */
  height: number
}

interface ObserverEntry {
  target: Element
  contentRect: { height: number; width: number }
}

/**
 * Capture every `ResizeObserver` instance the component creates so
 * tests can fire entries synchronously and inspect the observed
 * elements. Replaces `globalThis.ResizeObserver` so the component
 * picks up the stub on `new ResizeObserver(...)`.
 */
const observers: Array<{
  observe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  fire: (entries: ObserverEntry[]) => void
}> = []

class ResizeObserverStub {
  public observe = vi.fn()
  public disconnect = vi.fn()
  public unobserve = vi.fn()
  constructor(cb: ResizeObserverCallback) {
    observers.push({
      observe: this.observe,
      disconnect: this.disconnect,
      fire: (entries) => cb(entries as unknown as ResizeObserverEntry[], this as unknown as ResizeObserver),
    })
  }
}

beforeEach(() => {
  observers.length = 0
  // happy-dom's ResizeObserver is a no-op; install our stub.
  ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub
})

afterEach(() => {
  delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver
})

/** Harness component that renders an item whose height we control. */
const Harness = defineComponent({
  props: {
    itemHeight: { type: Number, default: 80 },
    threshold: { type: Number, default: 50 },
    items: { type: Array as () => RowItem[], required: true },
  },
  components: { VirtualList },
  setup(props) {
    return () =>
      h(VirtualList, {
        items: props.items,
        itemHeight: props.itemHeight,
        threshold: props.threshold,
        overscan: 0,
      }, {
        default: (slot: { item: RowItem }) =>
          h('div', {
            class: 'row',
            'data-id': slot.item.id,
            'data-height': slot.item.height,
            style: { height: `${slot.item.height}px` },
          }, slot.item.id),
      })
  },
})

function itemsWithHeights(n: number, baseHeight = 80): RowItem[] {
  // Vary heights so the cumulative-offset math is non-trivial.
  return Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    height: baseHeight + (i % 3) * 12,
  }))
}

/** Fire the most recent container observer (height entry). */
function setContainerHeight(h: number): void {
  const last = observers[observers.length - 1]
  if (!last) throw new Error('No ResizeObserver captured')
  last.fire([{ target: document.body, contentRect: { height: h, width: 100 } }])
}

/** Fire a per-row observer with a measured height. */
function measureRow(el: Element, height: number): void {
  // Find the observer that's observing this element.
  for (const obs of observers) {
    // ResizeObserverStub stores the callback bound to `this`; we
    // only have access to the wrapping object. The component's
    // own observe() call doesn't expose the target back to us, so
    // we fall back to firing ALL observers with the row's
    // measured height — only the matching one will mutate state.
    obs.fire([{ target: el, contentRect: { height, width: 100 } }])
  }
}

describe('VirtualList — plain path (below threshold)', () => {
  it('renders every item when the count is below threshold', () => {
    const items = itemsWithHeights(5)
    const wrapper = mount(Harness, { props: { items } })
    expect(wrapper.findAll('.row')).toHaveLength(5)
  })

  it('does not install a ResizeObserver for the plain path', () => {
    const items = itemsWithHeights(5)
    mount(Harness, { props: { items } })
    // No observer because shouldVirtualize is false at this count.
    expect(observers.length).toBe(0)
  })
})

describe('VirtualList — virtualized path (above threshold, spec §20)', () => {
  const ITEMS = itemsWithHeights(60)
  const THRESHOLD = 50

  it('renders only the visible window plus overscan', async () => {
    const wrapper = mount(Harness, { props: { items: ITEMS, threshold: THRESHOLD } })
    // Trigger the container's ResizeObserver so the visible-range
    // computation has a height to work with.
    setContainerHeight(500)
    await wrapper.vm.$nextTick()
    const rendered = wrapper.findAll('.row').length
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThan(ITEMS.length)
  })

  it('uses measured heights to compute cumulative offsets', async () => {
    const wrapper = mount(Harness, { props: { items: ITEMS, threshold: THRESHOLD } })
    // The container's ResizeObserver is the *first* one captured
    // (per-row observers come later as rows mount).
    setContainerHeight(500)
    await wrapper.vm.$nextTick()

    // Find each row's DOM element and feed its measured height
    // back through the observer chain. The component stores them
    // and re-derives offsets.
    const items = wrapper.findAll('.virtual-list-item')
    items.forEach((item) => {
      const rowEl = item.find('.row').element as HTMLElement
      const id = rowEl.dataset['id']
      const height = Number(rowEl.dataset['height'])
      if (id) measureRow(item.element, height)
    })
    await wrapper.vm.$nextTick()

    // Spec §20 acceptance: "no rendered card overlaps its
    // neighbour". The second row's `top` is the first row's
    // measured height, not the estimate.
    const first = items[0]?.element as HTMLElement | undefined
    const second = items[1]?.element as HTMLElement | undefined
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(first?.style.transform).toMatch(/translateY\(0(px)?\)/)
    const firstRowEl = first?.querySelector('.row') as HTMLElement | undefined
    const firstHeight = Number(firstRowEl?.dataset['height'])
    const secondTransform = second?.style.transform ?? ''
    const match = secondTransform.match(/translateY\(([\d.]+)px\)/)
    const secondTop = match ? Number(match[1]) : NaN
    expect(secondTop).toBeCloseTo(firstHeight, 0)
  })

  it('falls back to props.itemHeight for rows that have not been measured', async () => {
    const wrapper = mount(Harness, {
      props: { items: ITEMS, threshold: THRESHOLD, itemHeight: 80 },
    })
    setContainerHeight(500)
    await wrapper.vm.$nextTick()
    // Do NOT measure any row. Every offset must still be a valid
    // (cumulative-fallback) position so the user sees no
    // catastrophic layout collapse on first paint.
    const items = wrapper.findAll('.virtual-list-item')
    expect(items.length).toBeGreaterThan(0)
    items.forEach((item, i) => {
      const transform = (item.element as HTMLElement).style.transform
      const match = transform.match(/translateY\(([\d.]+)px\)/)
      const top = match ? Number(match[1]) : NaN
      expect(top).toBeCloseTo(i * 80, 0)
    })
  })
})
