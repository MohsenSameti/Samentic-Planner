/**
 * Tests for the `useNotes` composable.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotes } from './useNotes.js'
import type { DayNote, WeekNote } from '../types/index.js'

vi.mock('../api.js', () => ({
  api: {
    getDayNotes: vi.fn(),
    getWeekNotes: vi.fn(),
    setDayNote: vi.fn(),
    setWeekNote: vi.fn(),
  },
}))

import { api } from '../api.js'

describe('useNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes empty', () => {
    const { dayNotes, weekNotes } = useNotes()
    expect(dayNotes.value).toEqual([])
    expect(weekNotes.value).toEqual([])
  })

  it('loadNotes fetches day and week notes in parallel', async () => {
    const days: DayNote[] = [{ date: '2024-01-01', note: 'a' }]
    const weeks: WeekNote[] = [{ weekStart: '2024-01-01', note: 'plan' }]
    vi.mocked(api.getDayNotes).mockResolvedValue(days)
    vi.mocked(api.getWeekNotes).mockResolvedValue(weeks)
    const { dayNotes, weekNotes, loadNotes } = useNotes()
    await loadNotes()
    expect(dayNotes.value).toEqual(days)
    expect(weekNotes.value).toEqual(weeks)
  })

  describe('setDayNote', () => {
    it('inserts a new note', async () => {
      vi.mocked(api.setDayNote).mockResolvedValue({ date: '2024-01-01', note: 'hi' })
      const { dayNotes, setDayNote } = useNotes()
      await setDayNote('2024-01-01', 'hi')
      expect(dayNotes.value).toHaveLength(1)
      expect(dayNotes.value[0]?.note).toBe('hi')
    })

    it('updates an existing note in place', async () => {
      vi.mocked(api.setDayNote).mockResolvedValue({ date: '2024-01-01', note: 'updated' })
      const { dayNotes, setDayNote } = useNotes()
      dayNotes.value = [{ date: '2024-01-01', note: 'original' }]
      await setDayNote('2024-01-01', 'updated')
      expect(dayNotes.value).toHaveLength(1)
      expect(dayNotes.value[0]?.note).toBe('updated')
    })
  })

  describe('setWeekNote', () => {
    it('inserts and updates a week note', async () => {
      vi.mocked(api.setWeekNote).mockResolvedValue({ weekStart: '2024-01-01', note: 'updated' })
      const { weekNotes, setWeekNote } = useNotes()
      await setWeekNote('2024-01-01', 'plan')
      expect(weekNotes.value).toHaveLength(1)
      await setWeekNote('2024-01-01', 'updated')
      expect(weekNotes.value).toHaveLength(1)
      expect(weekNotes.value[0]?.note).toBe('updated')
    })
  })

  describe('getDayNote / getWeekNote', () => {
    it('returns the note string for the given date/week', () => {
      const { dayNotes, weekNotes, getDayNote, getWeekNote } = useNotes()
      dayNotes.value = [{ date: '2024-01-01', note: 'a' }]
      weekNotes.value = [{ weekStart: '2024-01-01', note: 'b' }]
      expect(getDayNote('2024-01-01')).toBe('a')
      expect(getWeekNote('2024-01-01')).toBe('b')
    })

    it('returns an empty string when the date is not stored', () => {
      const { getDayNote, getWeekNote } = useNotes()
      expect(getDayNote('2024-12-31')).toBe('')
      expect(getWeekNote('2024-12-31')).toBe('')
    })
  })
})
