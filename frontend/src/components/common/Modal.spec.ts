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
import { afterEach, describe, expect, it, vi } from 'vitest'
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

describe('Modal Escape keydown', () => {
  it('calls stopPropagation and stopImmediatePropagation and emits close when open', async () => {
    const wrapper = mount(Modal, {
      props: { show: true, title: 'Test Modal' },
      attachTo: document.body,
    })

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    const stopPropagationSpy = vi.spyOn(event, 'stopPropagation')
    const stopImmediatePropagationSpy = vi.spyOn(event, 'stopImmediatePropagation')

    document.dispatchEvent(event)
    await nextTick()

    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close')?.length).toBe(1)
    expect(stopPropagationSpy).toHaveBeenCalled()
    expect(stopImmediatePropagationSpy).toHaveBeenCalled()
  })

  it('does not stop propagation or emit close when closed', async () => {
    const wrapper = mount(Modal, {
      props: { show: false, title: 'Test Modal' },
      attachTo: document.body,
    })

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    const stopPropagationSpy = vi.spyOn(event, 'stopPropagation')
    const stopImmediatePropagationSpy = vi.spyOn(event, 'stopImmediatePropagation')

    document.dispatchEvent(event)
    await nextTick()

    expect(wrapper.emitted('close')).toBeFalsy()
    expect(stopPropagationSpy).not.toHaveBeenCalled()
    expect(stopImmediatePropagationSpy).not.toHaveBeenCalled()
  })

  it('does not stop propagation or emit close for non-Escape keys when open', async () => {
    const wrapper = mount(Modal, {
      props: { show: true, title: 'Test Modal' },
      attachTo: document.body,
    })

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    const stopPropagationSpy = vi.spyOn(event, 'stopPropagation')
    const stopImmediatePropagationSpy = vi.spyOn(event, 'stopImmediatePropagation')

    document.dispatchEvent(event)
    await nextTick()

    expect(wrapper.emitted('close')).toBeFalsy()
    expect(stopPropagationSpy).not.toHaveBeenCalled()
    expect(stopImmediatePropagationSpy).not.toHaveBeenCalled()
  })

  it('intercepts Escape in capture phase so downstream document listeners do not fire', async () => {
    const bubbleListener = vi.fn()
    document.addEventListener('keydown', bubbleListener)

    try {
      mount(Modal, {
        props: { show: true, title: 'Test Modal' },
        attachTo: document.body,
      })

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      })
      document.dispatchEvent(event)
      await nextTick()

      expect(bubbleListener).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('keydown', bubbleListener)
    }
  })
})

describe('Modal focus management and accessibility', () => {
  it('exposes aria-modal="true" on the active dialog', async () => {
    const wrapper = mount(Modal, {
      props: { show: true, title: 'Active Modal' },
      attachTo: document.body,
    })
    const dialog = wrapper.find('[role="dialog"]')
    expect(dialog.attributes('aria-modal')).toBe('true')
  })

  it('moves initial focus to the first focusable element inside the modal when opened', async () => {
    const trigger = document.createElement('button')
    trigger.id = 'open-trigger'
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    const wrapper = mount(Modal, {
      props: { show: true, title: 'Focus Test' },
      slots: {
        default: '<button id="modal-btn">Action</button>',
      },
      attachTo: document.body,
    })
    await nextTick()

    // The first focusable element in Modal is the close button
    const closeBtn = wrapper.find<HTMLButtonElement>('.modal-close').element
    expect(document.activeElement).toBe(closeBtn)

    trigger.remove()
  })

  it('wraps focus from the last focusable element to the first on Tab', async () => {
    const wrapper = mount(Modal, {
      props: { show: true, title: 'Tab Wrap Test' },
      slots: {
        default: '<button id="btn1">Button 1</button><button id="btn2">Button 2</button>',
      },
      attachTo: document.body,
    })
    await nextTick()

    const closeBtn = wrapper.find<HTMLButtonElement>('.modal-close').element
    const btn2 = wrapper.find<HTMLButtonElement>('#btn2').element

    btn2.focus()
    expect(document.activeElement).toBe(btn2)

    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    })
    document.dispatchEvent(tabEvent)
    await nextTick()

    expect(tabEvent.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(closeBtn)
  })

  it('wraps focus from the first focusable element to the last on Shift+Tab', async () => {
    const wrapper = mount(Modal, {
      props: { show: true, title: 'Shift Tab Wrap Test' },
      slots: {
        default: '<button id="btn1">Button 1</button><button id="btn2">Button 2</button>',
      },
      attachTo: document.body,
    })
    await nextTick()

    const closeBtn = wrapper.find<HTMLButtonElement>('.modal-close').element
    const btn2 = wrapper.find<HTMLButtonElement>('#btn2').element

    closeBtn.focus()
    expect(document.activeElement).toBe(closeBtn)

    const shiftTabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    document.dispatchEvent(shiftTabEvent)
    await nextTick()

    expect(shiftTabEvent.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(btn2)
  })

  it('returns focus to the element that opened it on close', async () => {
    const FocusHarness = defineComponent({
      components: { Modal },
      setup() {
        const show = ref(false)
        return { show }
      },
      template: `
        <div>
          <button id="harness-trigger" type="button" @click="show = true">Open Modal</button>
          <Modal :show="show" title="Harness Modal" @close="show = false">
            <button id="inside-btn" type="button">Inside</button>
          </Modal>
        </div>
      `,
    })

    const wrapper = mount(FocusHarness, { attachTo: document.body })
    const trigger = wrapper.find<HTMLButtonElement>('#harness-trigger').element
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    await wrapper.find('#harness-trigger').trigger('click')
    await nextTick()
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    expect(document.activeElement).not.toBe(trigger)

    await wrapper.find('.modal-close').trigger('click')
    await nextTick()
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('does not attempt to focus opener if it no longer exists or is disabled', async () => {
    const trigger = document.createElement('button')
    trigger.id = 'temporary-trigger'
    document.body.appendChild(trigger)
    trigger.focus()

    const wrapper = mount(Modal, {
      props: { show: true, title: 'Detached Opener Test' },
      attachTo: document.body,
    })
    await nextTick()

    // Remove trigger before closing
    trigger.remove()

    await wrapper.setProps({ show: false })
    await nextTick()

    expect(document.activeElement).not.toBe(trigger)
  })

  it('manages focus and aria-modal correctly with nested modals', async () => {
    const NestedHarness = defineComponent({
      components: { Modal },
      setup() {
        const show1 = ref(false)
        const show2 = ref(false)
        return { show1, show2 }
      },
      template: `
        <div>
          <button id="open-first" type="button" @click="show1 = true">Open 1</button>
          <Modal :show="show1" title="Modal 1" @close="show1 = false">
            <button id="open-second" type="button" @click="show2 = true">Open 2</button>
            <Modal :show="show2" title="Modal 2" @close="show2 = false">
              <button id="modal2-btn" type="button">Inner Action</button>
            </Modal>
          </Modal>
        </div>
      `,
    })

    const wrapper = mount(NestedHarness, { attachTo: document.body })
    const openFirstBtn = wrapper.find<HTMLButtonElement>('#open-first').element
    openFirstBtn.focus()

    // Open Modal 1
    await wrapper.find('#open-first').trigger('click')
    await nextTick()

    const dialogsAfter1 = wrapper.findAll('[role="dialog"]')
    expect(dialogsAfter1).toHaveLength(1)
    expect(dialogsAfter1[0]?.attributes('aria-modal')).toBe('true')

    // Open Modal 2 from inside Modal 1
    const openSecondBtn = wrapper.find<HTMLButtonElement>('#open-second').element
    openSecondBtn.focus()
    await wrapper.find('#open-second').trigger('click')
    await nextTick()

    const dialogsAfter2 = wrapper.findAll('[role="dialog"]')
    expect(dialogsAfter2).toHaveLength(2)
    // Only the topmost (Modal 2) is active and has aria-modal="true"
    expect(dialogsAfter2[0]?.attributes('aria-modal')).toBeUndefined()
    expect(dialogsAfter2[1]?.attributes('aria-modal')).toBe('true')

    // Top modal traps Tab
    const modal2CloseBtn = dialogsAfter2[1]?.find<HTMLButtonElement>('.modal-close').element
    const modal2ActionBtn = wrapper.find<HTMLButtonElement>('#modal2-btn').element
    modal2ActionBtn?.focus()

    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    })
    document.dispatchEvent(tabEvent)
    await nextTick()

    expect(tabEvent.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(modal2CloseBtn)

    // Close Modal 2
    await dialogsAfter2[1]?.find('.modal-close').trigger('click')
    await nextTick()

    // Focus returns to the element that opened Modal 2 (openSecondBtn inside Modal 1)
    expect(document.activeElement).toBe(openSecondBtn)

    // Modal 1 becomes active again
    const dialogsAfterClose2 = wrapper.findAll('[role="dialog"]')
    expect(dialogsAfterClose2).toHaveLength(1)
    expect(dialogsAfterClose2[0]?.attributes('aria-modal')).toBe('true')

    // Close Modal 1
    await dialogsAfterClose2[0]?.find('.modal-close').trigger('click')
    await nextTick()

    // Focus returns to openFirstBtn
    expect(document.activeElement).toBe(openFirstBtn)
  })
})
