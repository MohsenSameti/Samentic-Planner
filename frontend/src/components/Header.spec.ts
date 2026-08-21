/**
 * Tests for the `Header` component.
 *
 * `Header` is a pure presentational component: it shows the
 * burger/X sidebar toggle, the Planner logo/name, the "Today"
 * button, the settings (gear) menu, and the logout button. Week
 * navigation (prev / display / next) was moved to `WeekNavigation.vue`
 * and is covered in `WeekNavigation.spec.ts`. Tests assert on the
 * rendered text and event emissions.
 */
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import Header from './Header.vue'

const defaultProps = {
  sidebarCollapsed: true,
}

describe('Header', () => {
  it('renders the logo text', () => {
    const wrapper = mount(Header, { props: defaultProps })
    expect(wrapper.find('.logo h1').text()).toBe('Planner')
  })

  it('emits go-today when the Today button is clicked', async () => {
    const wrapper = mount(Header, { props: defaultProps })
    await wrapper.find('.today-btn').trigger('click')
    expect(wrapper.emitted('go-today')).toBeTruthy()
  })

  it('emits toggle-sidebar when the sidebar toggle is clicked', async () => {
    const wrapper = mount(Header, { props: defaultProps })
    await wrapper.find('.sidebar-toggle').trigger('click')
    expect(wrapper.emitted('toggle-sidebar')).toBeTruthy()
  })

  it('renders the logout button with an accessible label', () => {
    const wrapper = mount(Header, { props: defaultProps })
    const btn = wrapper.find('.logout-btn')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('aria-label')).toBe('Log out')
  })

  it('emits logout when the logout button is clicked', async () => {
    const wrapper = mount(Header, { props: defaultProps })
    await wrapper.find('.logout-btn').trigger('click')
    expect(wrapper.emitted('logout')).toBeTruthy()
  })

  describe('settings menu', () => {
    it('renders a settings button with an accessible label', () => {
      const wrapper = mount(Header, { props: defaultProps })
      const btn = wrapper.find('.settings-btn')
      expect(btn.exists()).toBe(true)
      expect(btn.attributes('aria-label')).toBe('Settings')
      expect(btn.attributes('aria-haspopup')).toBe('menu')
      expect(btn.attributes('aria-expanded')).toBe('false')
    })

    it('opens the menu and sets aria-expanded when the gear is clicked', async () => {
      const wrapper = mount(Header, { props: defaultProps })
      expect(wrapper.find('.settings-menu').exists()).toBe(false)

      await wrapper.find('.settings-btn').trigger('click')
      await nextTick()

      expect(wrapper.find('.settings-menu').exists()).toBe(true)
      expect(
        wrapper.find('.settings-btn').attributes('aria-expanded'),
      ).toBe('true')
    })

    it('closes the menu when the gear is clicked a second time', async () => {
      const wrapper = mount(Header, { props: defaultProps })
      await wrapper.find('.settings-btn').trigger('click')
      await nextTick()
      expect(wrapper.find('.settings-menu').exists()).toBe(true)

      await wrapper.find('.settings-btn').trigger('click')
      await nextTick()
      expect(wrapper.find('.settings-menu').exists()).toBe(false)
    })

    it('emits change-password and closes the menu when the item is clicked', async () => {
      const wrapper = mount(Header, { props: defaultProps })
      await wrapper.find('.settings-btn').trigger('click')
      await nextTick()

      await wrapper.find('.settings-menu-item').trigger('click')
      await nextTick()

      expect(wrapper.emitted('change-password')).toBeTruthy()
      expect(wrapper.emitted('change-password')?.length).toBe(1)
      expect(wrapper.find('.settings-menu').exists()).toBe(false)
    })

    it('closes the menu when Escape is pressed', async () => {
      const wrapper = mount(Header, { props: defaultProps })
      await wrapper.find('.settings-btn').trigger('click')
      await nextTick()
      expect(wrapper.find('.settings-menu').exists()).toBe(true)

      // Trigger the keydown handler directly (it's on `document`).
      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(event)
      await nextTick()

      expect(wrapper.find('.settings-menu').exists()).toBe(false)
    })

    it('closes the menu when clicking outside', async () => {
      const wrapper = mount(Header, {
        props: defaultProps,
        attachTo: document.body,
      })
      await wrapper.find('.settings-btn').trigger('click')
      await nextTick()
      expect(wrapper.find('.settings-menu').exists()).toBe(true)

      // Simulate a mousedown on an unrelated part of the document.
      const outsideEl = document.createElement('div')
      document.body.appendChild(outsideEl)
      const event = new MouseEvent('mousedown', { bubbles: true })
      outsideEl.dispatchEvent(event)
      await nextTick()

      expect(wrapper.find('.settings-menu').exists()).toBe(false)

      // Clean up the attached wrapper + synthetic element.
      wrapper.unmount()
      document.body.removeChild(outsideEl)
    })

    it('does NOT close the menu when clicking inside the menu or on the trigger', async () => {
      const wrapper = mount(Header, {
        props: defaultProps,
        attachTo: document.body,
      })
      await wrapper.find('.settings-btn').trigger('click')
      await nextTick()

      // Click on the menu itself — should not close.
      const menuEl = wrapper.find('.settings-menu').element as HTMLElement
      const eventInside = new MouseEvent('mousedown', { bubbles: true })
      menuEl.dispatchEvent(eventInside)
      await nextTick()
      expect(wrapper.find('.settings-menu').exists()).toBe(true)

      // Click on the trigger itself — should not close (the toggle
      // click handler already handles opening/closing explicitly).
      const triggerEl = wrapper.find('.settings-btn').element as HTMLElement
      const eventTrigger = new MouseEvent('mousedown', { bubbles: true })
      triggerEl.dispatchEvent(eventTrigger)
      await nextTick()
      // The mousedown handler ignores the trigger, so the menu stays open.
      // The subsequent click handler in the template would toggle it, but
      // here we only dispatched mousedown — verifying the mousedown gate.
      expect(wrapper.find('.settings-menu').exists()).toBe(true)

      wrapper.unmount()
    })
  })
})

