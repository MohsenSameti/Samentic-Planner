/**
 * Tests for the `SettingsSection` sidebar component.
 *
 * The component is a small presentational shell around two
 * `<select>`s — one for the start-of-week, one for the calendar.
 * Tests cover the rendering of options, the controlled value
 * binding, and the event emissions for both controls.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsSection from './SettingsSection.vue'
import type { Calendar, WeekStartDay } from '../../types/index.js'

describe('SettingsSection', () => {
  describe('start-of-week', () => {
    it('renders a select labelled "Start of week"', () => {
      const wrapper = mount(SettingsSection, {
        props: { weekStart: 6 as WeekStartDay, calendar: 'gregorian' as Calendar },
      })
      const selects = wrapper.findAll('select')
      const startSelect = selects.find(
        s => s.attributes('aria-label') === 'Start of week',
      )
      expect(startSelect?.exists()).toBe(true)
    })

    it('renders one option per weekday, in Date#getDay() order', () => {
      const wrapper = mount(SettingsSection, {
        props: { weekStart: 0 as WeekStartDay, calendar: 'gregorian' as Calendar },
      })
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
        props: { weekStart: 1 as WeekStartDay, calendar: 'gregorian' as Calendar },
      })
      const startSelect = wrapper.find('select[aria-label="Start of week"]')
        .element as HTMLSelectElement
      expect(startSelect.value).toBe('1')
    })

    it('emits change-week-start with the picked day on change', async () => {
      const wrapper = mount(SettingsSection, {
        props: { weekStart: 6 as WeekStartDay, calendar: 'gregorian' as Calendar },
      })
      const startSelect = wrapper.find('select[aria-label="Start of week"]')
      // `setValue` on the underlying DOM element + a `change` event
      // simulates the browser updating the value when the user picks a
      // new option.
      Object.defineProperty(startSelect.element, 'value', { value: '1', configurable: true })
      await startSelect.trigger('change')
      expect(wrapper.emitted('change-week-start')).toBeTruthy()
      expect(wrapper.emitted('change-week-start')?.[0]).toEqual([1])
    })

    it('does not emit change-week-start when the picked value is out of range', async () => {
      const wrapper = mount(SettingsSection, {
        props: { weekStart: 6 as WeekStartDay, calendar: 'gregorian' as Calendar },
      })
      const startSelect = wrapper.find('select[aria-label="Start of week"]')
      Object.defineProperty(startSelect.element, 'value', { value: '99', configurable: true })
      await startSelect.trigger('change')
      expect(wrapper.emitted('change-week-start')).toBeFalsy()
    })
  })

  describe('calendar', () => {
    it('renders a select labelled "Calendar"', () => {
      const wrapper = mount(SettingsSection, {
        props: { weekStart: 6 as WeekStartDay, calendar: 'gregorian' as Calendar },
      })
      const calSelect = wrapper.find('select[aria-label="Calendar"]')
      expect(calSelect.exists()).toBe(true)
    })

    it('renders two options: Gregorian and Jalali', () => {
      const wrapper = mount(SettingsSection, {
        props: { weekStart: 6 as WeekStartDay, calendar: 'gregorian' as Calendar },
      })
      const calSelect = wrapper.find('select[aria-label="Calendar"]')
      const options = calSelect.findAll('option')
      expect(options).toHaveLength(2)
      expect(options.map(o => o.text())).toEqual(['Gregorian', 'Jalali'])
      expect(options.map(o => o.attributes('value'))).toEqual(['gregorian', 'jalali'])
    })

    it('binds the calendar select value to the calendar prop', () => {
      const wrapper = mount(SettingsSection, {
        props: { weekStart: 6 as WeekStartDay, calendar: 'jalali' as Calendar },
      })
      const calSelect = wrapper.find('select[aria-label="Calendar"]')
        .element as HTMLSelectElement
      expect(calSelect.value).toBe('jalali')
    })

    it('emits change-calendar with "jalali" when the Jalali option is picked', async () => {
      const wrapper = mount(SettingsSection, {
        props: { weekStart: 6 as WeekStartDay, calendar: 'gregorian' as Calendar },
      })
      const calSelect = wrapper.find('select[aria-label="Calendar"]')
      Object.defineProperty(calSelect.element, 'value', { value: 'jalali', configurable: true })
      await calSelect.trigger('change')
      expect(wrapper.emitted('change-calendar')).toBeTruthy()
      expect(wrapper.emitted('change-calendar')?.[0]).toEqual(['jalali'])
    })

    it('emits change-calendar with "gregorian" when the Gregorian option is picked', async () => {
      const wrapper = mount(SettingsSection, {
        props: { weekStart: 6 as WeekStartDay, calendar: 'jalali' as Calendar },
      })
      const calSelect = wrapper.find('select[aria-label="Calendar"]')
      Object.defineProperty(calSelect.element, 'value', { value: 'gregorian', configurable: true })
      await calSelect.trigger('change')
      expect(wrapper.emitted('change-calendar')).toBeTruthy()
      expect(wrapper.emitted('change-calendar')?.[0]).toEqual(['gregorian'])
    })

    it('does not emit change-calendar when the picked value is out of range', async () => {
      const wrapper = mount(SettingsSection, {
        props: { weekStart: 6 as WeekStartDay, calendar: 'gregorian' as Calendar },
      })
      const calSelect = wrapper.find('select[aria-label="Calendar"]')
      Object.defineProperty(calSelect.element, 'value', { value: 'X', configurable: true })
      await calSelect.trigger('change')
      expect(wrapper.emitted('change-calendar')).toBeFalsy()
    })
  })

  describe('labels', () => {
    it('renders the human-readable label for the start-of-week row', () => {
      const wrapper = mount(SettingsSection, {
        props: { weekStart: 6 as WeekStartDay, calendar: 'gregorian' as Calendar },
      })
      const labels = wrapper.findAll('.setting-label').map(l => l.text())
      expect(labels).toContain('Start of week')
      expect(labels).toContain('Calendar')
    })
  })
})
