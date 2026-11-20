import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearManualCalendarOverride,
  loadManualCalendarOverride,
  resolveCalendarForLanguage,
  saveManualCalendarOverride,
} from './calendarPreference'

describe('manual calendar override', () => {
  beforeEach(() => {
    // Start each test with no persisted override so tests are isolated.
    clearManualCalendarOverride()
  })

  afterEach(() => {
    clearManualCalendarOverride()
  })
  it('uses the selected language default when no explicit override exists', () => {
    expect(resolveCalendarForLanguage('fa', null)).toBe('jalali')
    expect(resolveCalendarForLanguage('en', null)).toBe('gregorian')
  })

  it('loads and applies an explicit override across language changes', () => {
    saveManualCalendarOverride('gregorian')
    const override = loadManualCalendarOverride()
    expect(override).toBe('gregorian')
    expect(resolveCalendarForLanguage('fa', override)).toBe('gregorian')
    expect(resolveCalendarForLanguage('en', override)).toBe('gregorian')
  })

  it('ignores invalid persisted values and can clear the explicit choice', () => {
    localStorage.setItem('planner.calendarOverride', 'other')
    expect(loadManualCalendarOverride()).toBeNull()
    saveManualCalendarOverride('jalali')
    clearManualCalendarOverride()
    expect(loadManualCalendarOverride()).toBeNull()
  })
})
