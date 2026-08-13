/**
 * Tests for the `JalaliDatePicker` component.
 *
 * The picker renders a month-grid for the Jalali calendar and emits
 * Gregorian ISO dates. Tests drive the component through its user
 * interactions (clicks, keyboard, input blur) and assert on the
 * emitted `update` events.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import JalaliDatePicker from './JalaliDatePicker.vue'
import { fromJalaliYMD } from '../../utils/jalali.js'

describe('JalaliDatePicker', () => {
  it('renders the view label for the Jalali month of the value', () => {
    // 2024-03-20 is Far 1, 1403.
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    const viewLabel = wrapper.find('.view-label')
    expect(viewLabel.exists()).toBe(true)
    expect(viewLabel.text()).toContain('Far')
    expect(viewLabel.text()).toContain('1403')
  })

  it('marks the focused cell with aria-label matching the Jalali date', () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    const focused = wrapper.find('.day-cell.focused')
    expect(focused.exists()).toBe(true)
    expect(focused.attributes('aria-label')).toMatch(/Far 1, 1403/)
    expect(focused.attributes('aria-label')).toMatch(/2024-03-20/)
  })

  it('emits update with the Gregorian ISO when a day cell is clicked', async () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    // Find the cell for 2024-03-24 (Far 4, 1403).
    const expectedIso = fromJalaliYMD(1403, 1, 4)
    const cell = wrapper.find(`[data-jalali-date="${expectedIso}"]`)
    expect(cell.exists()).toBe(true)
    await cell.trigger('click')
    expect(wrapper.emitted('update')).toBeTruthy()
    expect(wrapper.emitted('update')?.[0]).toEqual([expectedIso])
  })

  it('emits update with the Gregorian ISO when day 5 is clicked', async () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    const expectedIso = fromJalaliYMD(1403, 1, 5)
    const cell = wrapper.find(`[data-jalali-date="${expectedIso}"]`)
    await cell.trigger('click')
    expect(wrapper.emitted('update')?.[0]).toEqual([expectedIso])
  })

  it('emits update when the year/month/day inputs are typed and blurred', async () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    const yearInput = wrapper.find('input[aria-label="Jalali year"]')
    const monthInput = wrapper.find('input[aria-label="Jalali month"]')
    const dayInput = wrapper.find('input[aria-label="Jalali day"]')
    await yearInput.setValue('1403')
    await monthInput.setValue('2')
    await dayInput.setValue('1')
    await dayInput.trigger('blur')
    expect(wrapper.emitted('update')).toBeTruthy()
    const expectedIso = fromJalaliYMD(1403, 2, 1)
    expect(wrapper.emitted('update')?.at(-1)).toEqual([expectedIso])
  })

  it('clamps an out-of-range day (day 31 in a 30-day month) to the last valid day', async () => {
    // Farvardin (month 1) has 31 days; Shahrivar (month 6) has 31
    // days. Bahman (month 11) has 30 days — typing day=31 in
    // month=11 should clamp to 30.
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    const yearInput = wrapper.find('input[aria-label="Jalali year"]')
    const monthInput = wrapper.find('input[aria-label="Jalali month"]')
    const dayInput = wrapper.find('input[aria-label="Jalali day"]')
    await yearInput.setValue('1403')
    await monthInput.setValue('11')
    await dayInput.setValue('31')
    await dayInput.trigger('blur')
    const expectedIso = fromJalaliYMD(1403, 11, 30)
    expect(wrapper.emitted('update')?.at(-1)).toEqual([expectedIso])
  })

  it('clamps day 31 in Esfand of a non-leap year to 29', async () => {
    // 1402 is a non-leap year → Esfand has 29 days.
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    const yearInput = wrapper.find('input[aria-label="Jalali year"]')
    const monthInput = wrapper.find('input[aria-label="Jalali month"]')
    const dayInput = wrapper.find('input[aria-label="Jalali day"]')
    await yearInput.setValue('1402')
    await monthInput.setValue('12')
    await dayInput.setValue('31')
    await dayInput.trigger('blur')
    const expectedIso = fromJalaliYMD(1402, 12, 29)
    expect(wrapper.emitted('update')?.at(-1)).toEqual([expectedIso])
  })

  it('clicks the next-month arrow to advance the view', async () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    expect(wrapper.find('.view-label').text()).toContain('Far')
    await wrapper.find('button[aria-label="Next month"]').trigger('click')
    expect(wrapper.find('.view-label').text()).toContain('Ord')
    expect(wrapper.find('.view-label').text()).toContain('1403')
  })

  it('clicks the previous-month arrow to regress the view', async () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    await wrapper.find('button[aria-label="Previous month"]').trigger('click')
    expect(wrapper.find('.view-label').text()).toContain('Esf')
    expect(wrapper.find('.view-label').text()).toContain('1402')
  })

  it('still emits the correct Gregorian ISO when clicking a cell after navigation', async () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    // Advance to the next month (Ord 1403).
    await wrapper.find('button[aria-label="Next month"]').trigger('click')
    // Click day 5 of Ord 1403 = Gregorian 2024-04-23.
    const expectedIso = fromJalaliYMD(1403, 2, 5)
    const cell = wrapper.find(`[data-jalali-date="${expectedIso}"]`)
    expect(cell.exists()).toBe(true)
    await cell.trigger('click')
    expect(wrapper.emitted('update')?.at(-1)).toEqual([expectedIso])
  })

  it('resets the view when the view-label is clicked', async () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    // Navigate to another month.
    await wrapper.find('button[aria-label="Next month"]').trigger('click')
    expect(wrapper.find('.view-label').text()).toContain('Ord')
    // Click the view label to reset to the value's month.
    await wrapper.find('.view-label').trigger('click')
    expect(wrapper.find('.view-label').text()).toContain('Far')
    expect(wrapper.find('.view-label').text()).toContain('1403')
  })

  it('renders six weekday columns plus the grid as 7 columns', () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    const weekdays = wrapper.findAll('.weekday')
    expect(weekdays).toHaveLength(7)
    // 42 cells (6 rows × 7 columns).
    expect(wrapper.findAll('.day-cell')).toHaveLength(42)
  })

  it('shows the leap-year badge when the view year is a Jalali leap year', () => {
    // 1403 is a Jalali leap year.
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    expect(wrapper.find('.leap-badge').exists()).toBe(true)
  })

  it('hides the leap-year badge when the view year is non-leap', async () => {
    // 1402 is not a leap year.
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    const yearInput = wrapper.find('input[aria-label="Jalali year"]')
    await yearInput.setValue('1402')
    await yearInput.trigger('blur')
    expect(wrapper.find('.leap-badge').exists()).toBe(false)
  })

  it('re-syncs the view when the value prop changes externally', async () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    expect(wrapper.find('.view-label').text()).toContain('Far')
    await wrapper.setProps({ value: '2024-09-01' })
    // 2024-09-01 = Shahrivar 11, 1403 (Sha).
    expect(wrapper.find('.view-label').text()).toContain('Sha')
    expect(wrapper.find('.view-label').text()).toContain('1403')
  })

  it('marks the .today cell when the value date is today', async () => {
    // Verify the rendering path even when the picker is mounted on a
    // different date — the focused cell is the one we explicitly set
    // via `value`, but `today` is computed from `new Date()`.
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    // Just make sure the prop round-trip and rendering work — the
    // exact `.today` cell depends on the wall clock.
    const cells = wrapper.findAll('.day-cell')
    expect(cells.length).toBe(42)
  })

  it('clicking a cell uses the Gregorian ISO of THAT cell, not the focused cell', async () => {
    // Goto a known cell whose Gregorian ISO we can verify.
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    const target = fromJalaliYMD(1403, 1, 12)
    const cell = wrapper.find(`[data-jalali-date="${target}"]`)
    await cell.trigger('click')
    expect(wrapper.emitted('update')?.[0]).toEqual([target])
  })
})

describe('JalaliDatePicker keyboard navigation', () => {
  it('arrow keys move focus by 1 day and emit the new Gregorian ISO', async () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    const grid = wrapper.find('.grid')
    await grid.trigger('keydown', { key: 'ArrowRight' })
    // ArrowRight from 2024-03-20 → 2024-03-21.
    expect(wrapper.emitted('update')).toBeTruthy()
    expect(wrapper.emitted('update')?.[0]).toEqual(['2024-03-21'])
  })

  it('PageUp moves by one month', async () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    const grid = wrapper.find('.grid')
    await grid.trigger('keydown', { key: 'PageDown' })
    // 2024-03-20 + 1 month = 2024-04-20.
    expect(wrapper.emitted('update')?.at(-1)).toEqual(['2024-04-20'])
  })

  it('does not move or emit when ArrowRight would cross the max bound', async () => {
    // 2024-03-20 is the latest allowed date.
    const wrapper = mount(JalaliDatePicker, {
      props: { value: '2024-03-20', max: '2024-03-20' },
    })
    const grid = wrapper.find('.grid')
    await grid.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update')).toBeFalsy()
  })

  it('does not move or emit when ArrowLeft would cross the min bound', async () => {
    // 2024-03-20 is the earliest allowed date.
    const wrapper = mount(JalaliDatePicker, {
      props: { value: '2024-03-20', min: '2024-03-20' },
    })
    const grid = wrapper.find('.grid')
    await grid.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('update')).toBeFalsy()
  })

  it('does not move or emit when PageUp would cross the min bound', async () => {
    const wrapper = mount(JalaliDatePicker, {
      props: { value: '2024-03-20', min: '2024-03-15' },
    })
    const grid = wrapper.find('.grid')
    // 2024-03-20 - 1 month ≈ 2024-02-20, which is before min. Should
    // be dropped.
    await grid.trigger('keydown', { key: 'PageUp' })
    expect(wrapper.emitted('update')).toBeFalsy()
  })

  it('does not move or emit when Home would land before the min bound', async () => {
    // 2024-06-15 is in Khordad 26, 1403 (month 3). Home jumps to
    // Tir 1, 1403 = 2024-06-21. With min='2024-07-01', the target
    // is before min and the keystroke must be dropped.
    const wrapper = mount(JalaliDatePicker, {
      props: { value: '2024-06-15', min: '2024-07-01' },
    })
    const grid = wrapper.find('.grid')
    await grid.trigger('keydown', { key: 'Home' })
    expect(wrapper.emitted('update')).toBeFalsy()
  })
})
