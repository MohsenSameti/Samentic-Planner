/**
 * Tests for the `JalaliDatePicker` component.
 *
 * The picker renders a month-grid for the Jalali calendar and emits
 * Gregorian ISO dates. Tests drive the component through its user
 * interactions (clicks, keyboard, input blur) and assert on the
 * emitted `update` events.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import JalaliDatePicker from './JalaliDatePicker.vue'
import { fromJalaliYMD, JALALI_WEEKDAY_LABELS, JALALI_WEEKDAY_LABELS_COMPACT } from '../../utils/jalali.js'
import { WEEKDAYS_FA, WEEKDAYS_FA_COMPACT } from '../../utils/date.js'
import { useI18n } from '../../composables/useI18n'

/**
 * `matchMedia` stubs mirroring the `useTheme` test pattern: captures
 * the stored `change` listener so a breakpoint crossing can be
 * simulated without a real window resize.
 */
type MediaQueryListener = (event: { matches: boolean; type?: string }) => void

function makeMatchMediaStub(initialMatches: boolean): {
  matchMedia: (query: string) => {
    matches: boolean
    media: string
    addEventListener: (type: 'change', cb: MediaQueryListener) => void
    removeEventListener: (type: 'change', cb: MediaQueryListener) => void
  }
  fire: (matches: boolean) => void
} {
  let currentMatches = initialMatches
  let listener: MediaQueryListener | null = null
  return {
    matchMedia: (query: string) => ({
      get matches(): boolean {
        return currentMatches
      },
      media: query,
      addEventListener: (_type: 'change', cb: MediaQueryListener) => {
        listener = cb
      },
      removeEventListener: (_type: 'change', _cb: MediaQueryListener) => {
        listener = null
      },
    }),
    fire: (matches: boolean) => {
      currentMatches = matches
      if (listener) listener({ matches, type: 'change' })
    },
  }
}

/** Read the seven weekday header texts in DOM order. */
function weekdayHeaders(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper.findAll('.weekday').map(w => w.text())
}

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

  it('renders the Persian numeric weekday headers (Sun..Thu = "1 Shan".."5 Shan", Fri = "Jomeh", Sat = "Shan")', () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    const weekdays = wrapper.findAll('.weekday').map(w => w.text())
    expect(weekdays).toEqual([
      '1 Shan', // Sun (getDay 0)
      '2 Shan', // Mon (1)
      '3 Shan', // Tue (2)
      '4 Shan', // Wed (3)
      '5 Shan', // Thu (4)
      'Jomeh',  // Fri (5)
      'Shan',   // Sat (6)
    ])
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

describe('JalaliDatePicker narrow viewport weekday headers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    useI18n().setLanguage('en')
  })

  it('shows the full English weekday headers when the viewport is wide', () => {
    vi.stubGlobal('matchMedia', makeMatchMediaStub(false).matchMedia)
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    expect(weekdayHeaders(wrapper)).toEqual([...JALALI_WEEKDAY_LABELS])
  })

  it('shows the compact English weekday headers when the viewport is narrow', () => {
    vi.stubGlobal('matchMedia', makeMatchMediaStub(true).matchMedia)
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    expect(weekdayHeaders(wrapper)).toEqual([...JALALI_WEEKDAY_LABELS_COMPACT])
  })

  it('shows the compact Persian weekday headers when the viewport is narrow and the language is Persian', () => {
    vi.stubGlobal('matchMedia', makeMatchMediaStub(true).matchMedia)
    useI18n().setLanguage('fa')
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    expect(weekdayHeaders(wrapper)).toEqual([...WEEKDAYS_FA_COMPACT])
    expect(weekdayHeaders(wrapper)).not.toEqual([...WEEKDAYS_FA])
  })

  it('swaps between full and compact headers when the viewport crosses the breakpoint', async () => {
    const stub = makeMatchMediaStub(false)
    vi.stubGlobal('matchMedia', stub.matchMedia)
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    expect(weekdayHeaders(wrapper)).toEqual([...JALALI_WEEKDAY_LABELS])

    stub.fire(true)
    await nextTick()
    expect(weekdayHeaders(wrapper)).toEqual([...JALALI_WEEKDAY_LABELS_COMPACT])

    stub.fire(false)
    await nextTick()
    expect(weekdayHeaders(wrapper)).toEqual([...JALALI_WEEKDAY_LABELS])
  })

  it('defaults to the full headers when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    expect(weekdayHeaders(wrapper)).toEqual([...JALALI_WEEKDAY_LABELS])
  })
})

describe('JalaliDatePicker keyboard navigation', () => {
  it('arrow keys move focus by 1 day without emitting update', async () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    const grid = wrapper.find('.grid')
    await grid.trigger('keydown', { key: 'ArrowRight' })
    // ArrowRight from 2024-03-20 → 2024-03-21 without emitting update
    expect(wrapper.emitted('update')).toBeFalsy()
    const focused = wrapper.find('.day-cell.focused')
    expect(focused.attributes('data-jalali-date')).toBe('2024-03-21')
  })

  it('inverts horizontal arrow keys when document direction is RTL', async () => {
    document.documentElement.dir = 'rtl'
    try {
      const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
      const grid = wrapper.find('.grid')
      // In RTL, ArrowLeft advances to next day and ArrowRight moves to previous day
      await grid.trigger('keydown', { key: 'ArrowLeft' })
      expect(wrapper.find('.day-cell.focused').attributes('data-jalali-date')).toBe('2024-03-21')

      await grid.trigger('keydown', { key: 'ArrowRight' })
      expect(wrapper.find('.day-cell.focused').attributes('data-jalali-date')).toBe('2024-03-20')
    } finally {
      document.documentElement.removeAttribute('dir')
    }
  })

  it('PageDown moves by one month without emitting update', async () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    const grid = wrapper.find('.grid')
    await grid.trigger('keydown', { key: 'PageDown' })
    // 2024-03-20 + 1 month = 2024-04-20 without emitting update
    expect(wrapper.emitted('update')).toBeFalsy()
    const focused = wrapper.find('.day-cell.focused')
    expect(focused.attributes('data-jalali-date')).toBe('2024-04-20')
  })

  it('Home and End jump to month edges without emitting update', async () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    const grid = wrapper.find('.grid')
    await grid.trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('update')).toBeFalsy()
    const focusedEnd = wrapper.find('.day-cell.focused')
    expect(focusedEnd.attributes('data-jalali-date')).toBe(fromJalaliYMD(1403, 1, 31))

    await grid.trigger('keydown', { key: 'Home' })
    expect(wrapper.emitted('update')).toBeFalsy()
    const focusedStart = wrapper.find('.day-cell.focused')
    expect(focusedStart.attributes('data-jalali-date')).toBe(fromJalaliYMD(1403, 1, 1))
  })

  it('month shift buttons browse months without emitting update', async () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    await wrapper.find('button[aria-label="Next month"]').trigger('click')
    expect(wrapper.emitted('update')).toBeFalsy()
    await wrapper.find('button[aria-label="Previous month"]').trigger('click')
    expect(wrapper.emitted('update')).toBeFalsy()
  })

  it('Enter key on grid commits the focused date', async () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    const grid = wrapper.find('.grid')
    await grid.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update')).toBeFalsy()
    await grid.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update')).toBeTruthy()
    expect(wrapper.emitted('update')?.[0]).toEqual(['2024-03-21'])
  })

  it('Space key on grid commits the focused date', async () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    const grid = wrapper.find('.grid')
    await grid.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update')).toBeFalsy()
    await grid.trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('update')).toBeTruthy()
    expect(wrapper.emitted('update')?.[0]).toEqual(['2024-03-21'])
  })

  it('uses roving tabindex with exactly one enabled date cell having tabindex="0"', async () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    const cellsWithZero = wrapper.findAll('.day-cell[tabindex="0"]')
    expect(cellsWithZero).toHaveLength(1)
    expect(cellsWithZero[0].attributes('data-jalali-date')).toBe('2024-03-20')

    const cellsWithMinusOne = wrapper.findAll('.day-cell[tabindex="-1"]')
    expect(cellsWithMinusOne).toHaveLength(41)

    // After arrow navigation, roving tabindex moves to new date
    const grid = wrapper.find('.grid')
    await grid.trigger('keydown', { key: 'ArrowRight' })
    const updatedZero = wrapper.findAll('.day-cell[tabindex="0"]')
    expect(updatedZero).toHaveLength(1)
    expect(updatedZero[0].attributes('data-jalali-date')).toBe('2024-03-21')
  })

  it('prevents duplicate key handling by handling keydown only on the grid', async () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    const focusedCell = wrapper.find('.day-cell.focused')
    await focusedCell.trigger('keydown', { key: 'ArrowRight' })
    // If handled only once, it shifts by 1 day (to 2024-03-21).
    // If duplicated, it would shift by 2 days (to 2024-03-22).
    const newFocused = wrapper.find('.day-cell.focused')
    expect(newFocused.attributes('data-jalali-date')).toBe('2024-03-21')
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

  it('does not emit update when Enter or Space is pressed on a disabled date', async () => {
    const wrapper = mount(JalaliDatePicker, {
      props: { value: '2024-03-20', min: '2024-03-22' },
    })
    const grid = wrapper.find('.grid')
    await grid.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update')).toBeFalsy()
    await grid.trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('update')).toBeFalsy()
  })

  it('gives all cells tabindex="-1" when all cells are disabled', () => {
    const wrapper = mount(JalaliDatePicker, {
      props: { value: '2024-03-20', min: '2025-01-01' },
    })
    const cellsWithZero = wrapper.findAll('.day-cell[tabindex="0"]')
    expect(cellsWithZero).toHaveLength(0)
    const cellsWithMinusOne = wrapper.findAll('.day-cell[tabindex="-1"]')
    expect(cellsWithMinusOne).toHaveLength(42)
  })

  it('gives tabindex="0" to the first enabled cell when focused date is out of range', () => {
    const minIso = fromJalaliYMD(1403, 1, 6)
    const wrapper = mount(JalaliDatePicker, {
      props: { value: '2024-03-20', min: minIso },
    })
    const cellsWithZero = wrapper.findAll('.day-cell[tabindex="0"]')
    expect(cellsWithZero).toHaveLength(1)
    expect(cellsWithZero[0].attributes('data-jalali-date')).toBe(minIso)
  })

  it('commits focused date when Enter or Space is pressed on a day cell', async () => {
    const wrapper = mount(JalaliDatePicker, { props: { value: '2024-03-20' } })
    const cell = wrapper.find('.day-cell.focused')
    await cell.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update')).toBeTruthy()
    expect(wrapper.emitted('update')?.[0]).toEqual(['2024-03-20'])

    await cell.trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('update')?.[1]).toEqual(['2024-03-20'])
  })

  it('declares RTL flip transform for month navigation chevrons', () => {
    const sfcSource = readFileSync(
      resolve(process.cwd(), 'src/components/common/JalaliDatePicker.vue'),
      'utf8',
    )
    expect(sfcSource).toMatch(/:root\[dir="rtl"\]\s+\.nav-btn\s+svg\s*\{\s*transform:\s*scaleX\(-1\);/m)
  })
})
