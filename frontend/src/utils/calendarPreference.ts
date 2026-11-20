import type { Calendar, Language } from '../types'

const MANUAL_CALENDAR_STORAGE_KEY = 'planner.calendarOverride'

export function defaultCalendarForLanguage(language: Language): Calendar {
  return language === 'fa' ? 'jalali' : 'gregorian'
}

export function resolveCalendarForLanguage(
  language: Language,
  manualOverride: Calendar | null,
): Calendar {
  return manualOverride ?? defaultCalendarForLanguage(language)
}

export function loadManualCalendarOverride(): Calendar | null {
  try {
    const value = localStorage.getItem(MANUAL_CALENDAR_STORAGE_KEY)
    if (value === 'gregorian' || value === 'jalali') return value
  } catch {
    // Treat unavailable storage as no explicit choice; locale defaults remain usable.
  }
  return null
}

export function saveManualCalendarOverride(value: Calendar): boolean {
  if (value !== 'gregorian' && value !== 'jalali') return false
  try {
    localStorage.setItem(MANUAL_CALENDAR_STORAGE_KEY, value)
    return true
  } catch {
    return false
  }
}

export function clearManualCalendarOverride(): void {
  try {
    localStorage.removeItem(MANUAL_CALENDAR_STORAGE_KEY)
  } catch {
    // In-memory selection still works when local storage is unavailable.
  }
}
