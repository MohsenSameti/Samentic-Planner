/**
 * Tests for the `WeekNavigation` component.
 *
 * `WeekNavigation` is a pure presentational component: it shows the
 * centered week display string and a pair of nav buttons (previous /
 * next). It used to live inside `Header`; the controls were lifted
 * out into their own component so the toolbar could stay minimal.
 * Tests assert on the rendered text and event emissions.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import WeekNavigation from './WeekNavigation.vue'

/**
 * Read the SFC source for the dark-mode regression tests at the
 * bottom. happy-dom doesn't process the SFC's `<style scoped>`
 * block, so we lock in the *contract* via source-content regex
 * instead of `getComputedStyle` resolution. The pattern matches
 * the regression coverage in `Header.spec.ts` and `TaskModal.spec.ts`.
 */
const source = readFileSync(
  resolve(process.cwd(), 'src/components/WeekNavigation.vue'),
  'utf8',
)

const defaultProps = {
  weekDisplay: 'Jan 1 - 7, 2024',
}

describe('WeekNavigation', () => {
  it('renders the week display', () => {
    const wrapper = mount(WeekNavigation, { props: defaultProps })
    expect(wrapper.find('.week-display').text()).toBe('Jan 1 - 7, 2024')
  })

  it('emits prev-week when the first nav button is clicked', async () => {
    const wrapper = mount(WeekNavigation, { props: defaultProps })
    const navButtons = wrapper.findAll('.nav-btn')
    await navButtons[0]!.trigger('click')
    expect(wrapper.emitted('prev-week')).toBeTruthy()
  })

  it('emits next-week when the second nav button is clicked', async () => {
    const wrapper = mount(WeekNavigation, { props: defaultProps })
    const navButtons = wrapper.findAll('.nav-btn')
    await navButtons[1]!.trigger('click')
    expect(wrapper.emitted('next-week')).toBeTruthy()
  })

  it('aria-labels the nav buttons', () => {
    const wrapper = mount(WeekNavigation, { props: defaultProps })
    const navButtons = wrapper.findAll('.nav-btn')
    expect(navButtons[0]!.attributes('aria-label')).toBe('Previous week')
    expect(navButtons[1]!.attributes('aria-label')).toBe('Next week')
  })

  // --------------------------------------------------------------- //
  // Source-level regression coverage for the chevron icon colors. //
  // --------------------------------------------------------------- //
  //
  // The `.nav-btn` rule originally had `background: var(--surface)`
  // but no `color` declaration. Like the `Header` icon buttons, the
  // chevron SVG inside (which uses `stroke="currentColor"`) then
  // resolved to the browser UA `buttontext` color — which some
  // browsers render black even in dark mode. This block was missed
  // by the original dark-mode regression sweep; locking it in here
  // prevents the same omission from happening again.

  describe('dark-mode chevron colors (regression)', () => {
    it('does NOT reference the undefined --text token anywhere in the SFC', () => {
      expect(source).not.toMatch(/var\(--text\)/)
    })

    it('styles .nav-btn with var(--text-primary), not a hard-coded color', () => {
      // The SFC's scoped style uses standard CSS, so a regex
      // anchored to the selector picks up the property list. The
      // `[\s\S]*?` is non-greedy so we capture only the body of
      // the first matching rule.
      const rule = /\.nav-btn\s*\{([\s\S]*?)\}/
      const match = source.match(rule)
      expect(match, 'expected to find a CSS rule for .nav-btn').toBeTruthy()
      if (!match) return
      expect(match[1]).toMatch(/color\s*:\s*var\(--text-primary\)/)
    })
  })
})
