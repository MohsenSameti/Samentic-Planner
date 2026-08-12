/**
 * Tests for the `SettingsSection` sidebar component.
 *
 * The component is a small presentational shell around a `<select>`.
 * Tests cover the rendering of the seven day options, the controlled
 * value binding, and the `change-week-start` event emission.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsSection from './SettingsSection.vue'
import type { WeekStartDay } from '../../types/index.js'

describe('SettingsSection', () => {
  it('renders a select labelled "Start of week"', () => {
    const wrapper = mount(SettingsSection, {
      props: { weekStart: 6 as WeekStartDay },
    })
    const select = wrapper.find('select')
    expect(select.exists()).toBe(true)
    expect(select.attributes('aria-label')).toBe('Start of week')
  })

  it('renders one option per weekday, in Date#getDay() order', () => {
    const wrapper = mount(SettingsSection, {
      props: { weekStart: 0 as WeekStartDay },
    })
    const options = wrapper.findAll('option')
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

  it('binds the select value to the weekStart prop', () => {
    const wrapper = mount(SettingsSection, {
      props: { weekStart: 1 as WeekStartDay },
    })
    const select = wrapper.find('select').element as HTMLSelectElement
    expect(select.value).toBe('1')
  })

  it('emits change-week-start with the picked day on change', async () => {
    const wrapper = mount(SettingsSection, {
      props: { weekStart: 6 as WeekStartDay },
    })
    const select = wrapper.find('select')
    // `setValue` on the underlying DOM element + a `change` event
    // simulates the browser updating the value when the user picks a
    // new option.
    Object.defineProperty(select.element, 'value', { value: '1', configurable: true })
    await select.trigger('change')
    expect(wrapper.emitted('change-week-start')).toBeTruthy()
    expect(wrapper.emitted('change-week-start')?.[0]).toEqual([1])
  })

  it('does not emit when the picked value is out of range', async () => {
    const wrapper = mount(SettingsSection, {
      props: { weekStart: 6 as WeekStartDay },
    })
    const select = wrapper.find('select')
    Object.defineProperty(select.element, 'value', { value: '99', configurable: true })
    await select.trigger('change')
    expect(wrapper.emitted('change-week-start')).toBeFalsy()
  })

  it('renders the human-readable label for the active option', () => {
    const wrapper = mount(SettingsSection, {
      props: { weekStart: 6 as WeekStartDay },
    })
    expect(wrapper.find('.setting-label').text()).toBe('Start of week')
  })
})
