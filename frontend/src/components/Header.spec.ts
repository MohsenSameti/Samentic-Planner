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
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { contrastRatio, resolveCssColor } from '../test/contrast'
import Header from './Header.vue'

/**
 * Read the SFC source. Used by the source-level regression tests at
 * the bottom of this file — happy-dom doesn't process the SFC's
 * `<style scoped>` block, so we can't drive a `getComputedStyle`
 * assertion on `.logout-btn` etc. Instead, we lock in the
 * contract that the broken `var(--text)` reference is gone and the
 * rules use the real `var(--text-primary)` token. The token's
 * value in both themes is already locked in by `style.css`'s
 * `:root` / `:root[data-theme="dark"]` declarations.
 */
const source = readFileSync(
  // Vitest's loader doesn't expose `import.meta.url` as a `file://`
  // URL, so resolve the SFC relative to the working directory (the
  // repo root in `pnpm test`).
  resolve(process.cwd(), 'src/components/Header.vue'),
  'utf8',
)

const appSource = readFileSync(
  resolve(process.cwd(), 'src/App.vue'),
  'utf8',
)

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

  // --------------------------------------------------------------- //
  // Source-level regression coverage for dark-mode icon colors.    //
  // --------------------------------------------------------------- //
  //
  // The original `Header.vue` used `color: var(--text)` for the three
  // icon buttons (logout, settings, sidebar-toggle). `--text` is not
  // a defined token, so the property was invalid and the buttons fell
  // back to the browser UA `buttontext` color — which some browsers
  // render black even in dark mode. These tests lock in that the
  // broken reference is gone and the rules now use
  // `var(--text-primary)` (the real, theme-aware token).

  describe('dark-mode icon colors (regression)', () => {
    it('does NOT reference the undefined --text token anywhere in the SFC', () => {
      expect(source).not.toMatch(/var\(--text\)/)
    })

    it.each([
      '.logout-btn',
      '.settings-btn',
      '.sidebar-toggle',
    ])('styles %s with var(--text-primary), not a hard-coded color', (selector) => {
      // Find the rule body for the selector. The SFC's scoped style
      // uses standard CSS, so a regex anchored to the selector
      // picks up the property list.
      const escaped = selector.replace(/\./g, '\\.')
      const rule = new RegExp(`${escaped}\\s*\\{[^}]*\\}`)
      const match = source.match(rule)
      expect(match, `expected to find a CSS rule for ${selector}`).toBeTruthy()
      if (!match) return
      expect(match[0]).toMatch(/var\(--text-primary\)/)
    })
  })

  describe('Today button contrast (Task 4.1)', () => {
    it('styles .today-btn with var(--accent-contrast, #1A1612)', () => {
      const match = source.match(/\.today-btn\s*\{[^}]*\}/)
      expect(match, 'expected to find a CSS rule for .today-btn').toBeTruthy()
      expect(match?.[0]).toMatch(/color\s*:\s*var\(--accent-contrast,\s*#1A1612\)/)
    })

    it('has contrast ratio >= 4.5:1 against --accent background', () => {
      const match = source.match(/\.today-btn\s*\{[^}]*\}/)
      expect(match).toBeTruthy()
      const rule = match?.[0] ?? ''
      const fgColorExpr = rule.match(/color\s*:\s*([^;]+);/)?.[1]?.trim() ?? ''
      const bgColorExpr = rule.match(/background\s*:\s*([^;]+);/)?.[1]?.trim() ?? ''
      const vars = {
        '--accent': '#C5A065',
        '--accent-contrast': '#1A1612',
      }
      const fg = resolveCssColor(fgColorExpr, vars)
      const bg = resolveCssColor(bgColorExpr, vars)
      const ratio = contrastRatio(fg, bg)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })
  })

  describe('mobile touch hit areas (Task 5.1)', () => {
    it('bumps .sidebar-toggle, .settings-btn, and .logout-btn to 44px on mobile', () => {
      expect(source).toMatch(/@media\s*\(\s*max-width\s*:\s*768px\s*\)[\s\S]*\.sidebar-toggle\s*\{[^}]*width:\s*44px;\s*height:\s*44px;/)
      expect(source).toMatch(/@media\s*\(\s*max-width\s*:\s*768px\s*\)[\s\S]*\.settings-btn\s*\{[^}]*width:\s*44px;\s*height:\s*44px;/)
      expect(source).toMatch(/@media\s*\(\s*max-width\s*:\s*768px\s*\)[\s\S]*\.logout-btn\s*\{[^}]*width:\s*44px;\s*height:\s*44px;/)
    })

    it('ensures .today-btn has at least 44x44px min dimensions and inline-flex on mobile', () => {
      expect(source).toMatch(/@media\s*\(\s*max-width\s*:\s*768px\s*\)[\s\S]*\.today-btn\s*\{[^}]*min-height:\s*44px;/)
      expect(source).toMatch(/@media\s*\(\s*max-width\s*:\s*768px\s*\)[\s\S]*\.today-btn\s*\{[^}]*min-width:\s*44px;/)
      expect(source).toMatch(/@media\s*\(\s*max-width\s*:\s*768px\s*\)[\s\S]*\.today-btn\s*\{[^}]*display:\s*inline-flex;/)
    })
  })

  describe('narrow viewport layout and flex sizing (Task 5.3)', () => {
    it('does NOT contain 73px subtraction literals anywhere in App.vue styles', () => {
      expect(appSource).not.toMatch(/73px/)
    })

    it('ensures .main-container has flex: 1 and min-height: 0 in App.vue', () => {
      const match = appSource.match(/\.main-container\s*\{([^}]*)\}/)
      expect(match, 'expected .main-container rule in App.vue').toBeTruthy()
      const rule = match?.[1] ?? ''
      expect(rule).toMatch(/flex\s*:\s*1/)
      expect(rule).toMatch(/min-height\s*:\s*0/)
    })

    it('ensures .week-container has flex: 1, min-height: 0, and overflow-y: auto in App.vue desktop styles', () => {
      const desktopStyles = appSource.split(/@media/)[0] ?? ''
      const match = desktopStyles.match(/\.week-container\s*\{([^}]*)\}/)
      expect(match, 'expected base .week-container rule in App.vue').toBeTruthy()
      const rule = match?.[1] ?? ''
      expect(rule).toMatch(/flex\s*:\s*1/)
      expect(rule).toMatch(/min-height\s*:\s*0/)
      expect(rule).toMatch(/overflow-y\s*:\s*auto/)
      expect(rule).not.toMatch(/(?<!-)height\s*:/)
    })

    it('ensures .week-container has flex: 1, min-height: 0, and overflow-y: auto in App.vue mobile @media (max-width: 768px)', () => {
      const mobileMatch = appSource.match(/@media\s*\(\s*max-width\s*:\s*768px\s*\)\s*\{([\s\S]*?)\n\}/)
      expect(mobileMatch, 'expected mobile media query in App.vue').toBeTruthy()
      const mobileStyles = mobileMatch?.[1] ?? ''
      const match = mobileStyles.match(/\.week-container\s*\{([^}]*)\}/)
      expect(match, 'expected .week-container in mobile media query in App.vue').toBeTruthy()
      const rule = match?.[1] ?? ''
      expect(rule).toMatch(/flex\s*:\s*1/)
      expect(rule).toMatch(/min-height\s*:\s*0/)
      expect(rule).toMatch(/overflow-y\s*:\s*auto/)
      expect(rule).not.toMatch(/(?<!-)height\s*:/)
    })

    it('ensures .header in Header.vue has flex-wrap: wrap on mobile/narrow viewports', () => {
      const mobileMatch = source.match(/@media\s*\(\s*max-width\s*:\s*768px\s*\)\s*\{([\s\S]*?)\n\}/)
      expect(mobileMatch, 'expected mobile media query in Header.vue').toBeTruthy()
      const mobileStyles = mobileMatch?.[1] ?? ''
      const match = mobileStyles.match(/\.header\s*\{([^}]*)\}/)
      expect(match, 'expected .header in mobile media query in Header.vue').toBeTruthy()
      const rule = match?.[1] ?? ''
      expect(rule).toMatch(/flex-wrap\s*:\s*wrap/)
    })

    it('preserves unwrapped header layout on desktop / tablet (> 768px)', () => {
      const desktopStyles = source.split(/@media/)[0] ?? ''
      const match = desktopStyles.match(/\.header\s*\{([^}]*)\}/)
      expect(match, 'expected base .header rule in Header.vue').toBeTruthy()
      const rule = match?.[1] ?? ''
      expect(rule).not.toMatch(/flex-wrap\s*:\s*wrap/)
    })

    it('consolidates or wraps header controls to prevent horizontal clipping at 320px', () => {
      const mobileMatch = source.match(/@media\s*\(\s*max-width\s*:\s*768px\s*\)\s*\{([\s\S]*?)\n\}/)
      const mobileStyles = mobileMatch?.[1] ?? ''
      expect(mobileStyles).toMatch(/\.header\s*\{[^}]*flex-wrap\s*:\s*wrap/)
      expect(mobileStyles).toMatch(/\.header\s*\{[^}]*(?:gap|row-gap)/)
    })
  })
})



