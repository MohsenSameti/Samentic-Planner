/**
 * Tests for the `SettingsSection` sidebar component.
 *
 * The component is a small presentational shell around three
 * `<select>`s — one for the theme, one for the start-of-week, and
 * one for the calendar. Tests cover the rendering of options, the
 * controlled value binding, and the event emissions for each
 * control. The component is purely presentational — all state lives
 * in the parent (`App.vue`).
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsSection from './SettingsSection.vue'
import type { Calendar, Theme, WeekStartDay } from '../../types/index.js'

/**
 * Default props for a `mount(SettingsSection, ...)` call. Centralised
 * so the only thing each test has to specify is what it's exercising;
 * every test that doesn't care about a particular prop gets the
 * default and any required prop stays required.
 */
const defaultProps = {
  theme: 'system' as Theme,
  weekStart: 6 as WeekStartDay,
  calendar: 'gregorian' as Calendar,
}

describe('SettingsSection', () => {
  describe('theme', () => {
    it('renders a select labelled "Theme"', () => {
      const wrapper = mount(SettingsSection, { props: defaultProps })
      const selects = wrapper.findAll('select')
      const themeSelect = selects.find(
        s => s.attributes('aria-label') === 'Theme',
      )
      expect(themeSelect?.exists()).toBe(true)
    })

    it('renders three options in order: Light, Dark, System', () => {
      const wrapper = mount(SettingsSection, { props: defaultProps })
      const themeSelect = wrapper.find('select[aria-label="Theme"]')
      const options = themeSelect.findAll('option')
      expect(options).toHaveLength(3)
      expect(options.map(o => o.text())).toEqual(['Light', 'Dark', 'System'])
      expect(options.map(o => o.attributes('value'))).toEqual(['light', 'dark', 'system'])
    })

    it('binds the theme select value to the theme prop', () => {
      const wrapper = mount(SettingsSection, {
        props: { ...defaultProps, theme: 'dark' as Theme },
      })
      const themeSelect = wrapper.find('select[aria-label="Theme"]')
        .element as HTMLSelectElement
      expect(themeSelect.value).toBe('dark')
    })

    it('emits change-theme with "light" when the Light option is picked', async () => {
      const wrapper = mount(SettingsSection, { props: defaultProps })
      const themeSelect = wrapper.find('select[aria-label="Theme"]')
      Object.defineProperty(themeSelect.element, 'value', { value: 'light', configurable: true })
      await themeSelect.trigger('change')
      expect(wrapper.emitted('change-theme')).toBeTruthy()
      expect(wrapper.emitted('change-theme')?.[0]).toEqual(['light'])
    })

    it('emits change-theme with "dark" when the Dark option is picked', async () => {
      const wrapper = mount(SettingsSection, { props: defaultProps })
      const themeSelect = wrapper.find('select[aria-label="Theme"]')
      Object.defineProperty(themeSelect.element, 'value', { value: 'dark', configurable: true })
      await themeSelect.trigger('change')
      expect(wrapper.emitted('change-theme')?.[0]).toEqual(['dark'])
    })

    it('emits change-theme with "system" when the System option is picked', async () => {
      const wrapper = mount(SettingsSection, { props: defaultProps })
      const themeSelect = wrapper.find('select[aria-label="Theme"]')
      Object.defineProperty(themeSelect.element, 'value', { value: 'system', configurable: true })
      await themeSelect.trigger('change')
      expect(wrapper.emitted('change-theme')?.[0]).toEqual(['system'])
    })

    it('does not emit change-theme when the picked value is out of range', async () => {
      const wrapper = mount(SettingsSection, { props: defaultProps })
      const themeSelect = wrapper.find('select[aria-label="Theme"]')
      Object.defineProperty(themeSelect.element, 'value', { value: 'chartreuse', configurable: true })
      await themeSelect.trigger('change')
      expect(wrapper.emitted('change-theme')).toBeFalsy()
    })
  })

  describe('start-of-week', () => {
    it('renders a select labelled "Start of week"', () => {
      const wrapper = mount(SettingsSection, { props: defaultProps })
      const selects = wrapper.findAll('select')
      const startSelect = selects.find(
        s => s.attributes('aria-label') === 'Start of week',
      )
      expect(startSelect?.exists()).toBe(true)
    })

    it('renders one option per weekday, in Date#getDay() order', () => {
      const wrapper = mount(SettingsSection, { props: defaultProps })
      const startSelect = wrapper.find('select[aria-label="Start of week"]')
      const options = startSelect.findAll('option')
      expect(options).toHaveLength(7)
      expect(options.map(o => o.text())).toEqual([
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ])
      expect(options.map(o => o.attributes('value'))).toEqual([
        '0',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
      ])
    })

    it('binds the week-start select value to the weekStart prop', () => {
      const wrapper = mount(SettingsSection, {
        props: { ...defaultProps, weekStart: 1 as WeekStartDay },
      })
      const startSelect = wrapper.find('select[aria-label="Start of week"]')
        .element as HTMLSelectElement
      expect(startSelect.value).toBe('1')
    })

    it('emits change-week-start with the picked day on change', async () => {
      const wrapper = mount(SettingsSection, { props: defaultProps })
      const startSelect = wrapper.find('select[aria-label="Start of week"]')
      Object.defineProperty(startSelect.element, 'value', { value: '1', configurable: true })
      await startSelect.trigger('change')
      expect(wrapper.emitted('change-week-start')).toBeTruthy()
      expect(wrapper.emitted('change-week-start')?.[0]).toEqual([1])
    })

    it('does not emit change-week-start when the picked value is out of range', async () => {
      const wrapper = mount(SettingsSection, { props: defaultProps })
      const startSelect = wrapper.find('select[aria-label="Start of week"]')
      Object.defineProperty(startSelect.element, 'value', { value: '99', configurable: true })
      await startSelect.trigger('change')
      expect(wrapper.emitted('change-week-start')).toBeFalsy()
    })
  })

  describe('calendar', () => {
    it('renders a select labelled "Calendar"', () => {
      const wrapper = mount(SettingsSection, { props: defaultProps })
      const calSelect = wrapper.find('select[aria-label="Calendar"]')
      expect(calSelect.exists()).toBe(true)
    })

    it('renders two options: Gregorian and Jalali', () => {
      const wrapper = mount(SettingsSection, { props: defaultProps })
      const calSelect = wrapper.find('select[aria-label="Calendar"]')
      const options = calSelect.findAll('option')
      expect(options).toHaveLength(2)
      expect(options.map(o => o.text())).toEqual(['Gregorian', 'Jalali'])
      expect(options.map(o => o.attributes('value'))).toEqual(['gregorian', 'jalali'])
    })

    it('binds the calendar select value to the calendar prop', () => {
      const wrapper = mount(SettingsSection, {
        props: { ...defaultProps, calendar: 'jalali' as Calendar },
      })
      const calSelect = wrapper.find('select[aria-label="Calendar"]')
        .element as HTMLSelectElement
      expect(calSelect.value).toBe('jalali')
    })

    it('emits change-calendar with "jalali" when the Jalali option is picked', async () => {
      const wrapper = mount(SettingsSection, { props: defaultProps })
      const calSelect = wrapper.find('select[aria-label="Calendar"]')
      Object.defineProperty(calSelect.element, 'value', { value: 'jalali', configurable: true })
      await calSelect.trigger('change')
      expect(wrapper.emitted('change-calendar')).toBeTruthy()
      expect(wrapper.emitted('change-calendar')?.[0]).toEqual(['jalali'])
    })

    it('emits change-calendar with "gregorian" when the Gregorian option is picked', async () => {
      const wrapper = mount(SettingsSection, {
        props: { ...defaultProps, calendar: 'jalali' as Calendar },
      })
      const calSelect = wrapper.find('select[aria-label="Calendar"]')
      Object.defineProperty(calSelect.element, 'value', { value: 'gregorian', configurable: true })
      await calSelect.trigger('change')
      expect(wrapper.emitted('change-calendar')?.[0]).toEqual(['gregorian'])
    })

    it('does not emit change-calendar when the picked value is out of range', async () => {
      const wrapper = mount(SettingsSection, { props: defaultProps })
      const calSelect = wrapper.find('select[aria-label="Calendar"]')
      Object.defineProperty(calSelect.element, 'value', { value: 'X', configurable: true })
      await calSelect.trigger('change')
      expect(wrapper.emitted('change-calendar')).toBeFalsy()
    })
  })

  describe('labels', () => {
    it('renders the human-readable labels for all three rows in order', () => {
      const wrapper = mount(SettingsSection, { props: defaultProps })
      const labels = wrapper.findAll('.setting-label').map(l => l.text())
      // The Theme row is intentionally above the other two — the
      // theme is the most-touched display setting and lives at the
      // top of the settings panel.
      expect(labels).toEqual(['Theme', 'Start of week', 'Calendar'])
    })
  })
})
