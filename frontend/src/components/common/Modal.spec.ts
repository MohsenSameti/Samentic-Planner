/**
 * Tests for the shared `Modal` component.
 *
 * The valuable part here is the CSS regression guard: an earlier
 * refactor left the old class-based modal styles in the global
 * `style.css`, including:
 *
 *   .modal-overlay { opacity: 0; visibility: hidden; }
 *
 * `Modal.vue` toggles its overlay with `v-if` (there is no `.active`
 * class anymore) and its scoped styles never set `opacity` /
 * `visibility`, so that leftover global rule hid every modal in the
 * browser. The component tests stayed green because happy-dom applies
 * no CSS. The tests below scan the shipped stylesheets instead and fail
 * if the overlay is ever hidden again.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineComponent, nextTick, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import Modal from './Modal.vue'

// The outside-interaction tests attach to `document.body` (so events
// bubble up to `document`, matching the real app). Auto-unmount keeps
// those attached roots from leaking between tests.
enableAutoUnmount(afterEach)

const here = dirname(fileURLToPath(import.meta.url))

/** Read a project file relative to this spec. */
function read(relPath: string): string {
  return readFileSync(resolve(here, relPath), 'utf8')
}

/** Strip comments so commented-out rules can't trigger false positives. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * Extract the body of a *base* rule like `.modal-overlay { ... }`.
 * Returns `null` when no such rule exists. The lookahead excludes
 * compound selectors (`.modal-overlay.active`, `.modal-overlay:hover`)
 * so we only inspect the rule that applies to the plain element.
 */
function ruleBody(css: string, className: string): string | null {
  const match = new RegExp(
    `\\.${className}(?![\\w.-])\\s*\\{([^{}]*)\\}`,
  ).exec(css)
  return match?.[1] ?? null
}

/** Whether a rule body sets the element to be hidden. */
function declaresHidden(body: string | null): boolean {
  if (!body) return false
  return (
    /opacity\s*:\s*0(?![.\d])/.test(body) ||
    /visibility\s*:\s*hidden\b/.test(body) ||
    /display\s*:\s*none\b/.test(body)
  )
}

/** Extract every `<style>...</style>` block from an SFC source string. */
function styleBlocks(sfc: string): string[] {
  return [...sfc.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(
    (m) => m[1] ?? '',
  )
}

describe('Modal overlay visibility regression', () => {
  it('the global stylesheet never hides .modal-overlay', () => {
    const globalCss = stripComments(read('../../style.css'))
    const overlay = ruleBody(globalCss, 'modal-overlay')
    expect(declaresHidden(overlay)).toBe(false)
  })

  it('the Modal component does not hide its own .modal-overlay', () => {
    const modalSfc = read('./Modal.vue')
    for (const block of styleBlocks(modalSfc)) {
      const overlay = ruleBody(stripComments(block), 'modal-overlay')
      expect(declaresHidden(overlay)).toBe(false)
    }
  })
})

/**
 * Minimal harness for outside-interaction tests: a trigger button that
 * sits *outside* the dialog, plus a `Modal` whose `show` is driven by
 * the parent. The trigger mirrors how `App.vue` opens a modal (a click
 * that bubbles up to `document`).
 */
const Harness = defineComponent({
  components: { Modal },
  setup() {
    const show = ref(false)
    return { show }
  },
  template: `
    <button id="trigger" type="button" @click="show = true">open</button>
    <Modal :show="show" title="Test" @close="show = false">
      <div id="content">content</div>
    </Modal>
  `,
})

describe('Modal outside-interaction', () => {
  /**
   * The regression guard for the "create task" bug. `Modal.vue` used to
   * close on any `document` *click* outside the dialog. In a real
   * browser the trigger button receives focus during the click, so
   * Vue had already applied `show=true` by the time the same click
   * finished bubbling to `document` — the handler saw an "open" modal
   * with the click target outside it and closed it ~1ms after opening.
   *
   * The fix moves outside-close detection to `mousedown`, which
   * *precedes* the opening `click`, so the opening interaction can
   * never be mistaken for an outside click. The tests below pin that
   * contract: close on `mousedown`, ignore the trailing `click`.
   */
  it('closes when a mousedown lands outside the dialog', async () => {
    const wrapper = mount(Harness, { attachTo: document.body })
    await wrapper.find('#trigger').trigger('click')
    await nextTick()
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)

    await wrapper.find('#trigger').trigger('mousedown')
    await nextTick()
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
  })

  it('does not close on a click alone (the tail of the opening click)', async () => {
    const wrapper = mount(Harness, { attachTo: document.body })
    await wrapper.find('#trigger').trigger('click')
    await nextTick()
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)

    // A click (with no preceding mousedown) must not close the modal —
    // that is the exact event that opened it in the real browser.
    await wrapper.find('#trigger').trigger('click')
    await nextTick()
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
  })

  it('stays open when opened via a mousedown + click on the trigger', async () => {
    const wrapper = mount(Harness, { attachTo: document.body })
    const trigger = wrapper.find('#trigger')

    await trigger.trigger('mousedown')
    await trigger.trigger('click')
    await nextTick()

    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
  })
})
