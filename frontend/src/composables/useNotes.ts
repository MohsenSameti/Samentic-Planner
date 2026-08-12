import { ref } from 'vue'
import { api } from '../api'
import type { DayNote, WeekNote } from '../types'

/**
 * Owns the day-level and week-level freeform notes. They're grouped
 * together because they're conceptually the same kind of data (a free
 * text blob keyed by a date) and always loaded / unloaded together.
 *
 * Notes are upserted on the server with the date/weekly-key as the
 * natural primary key, so `setDayNote` / `setWeekNote` mutate by lookup
 * or insert when no row exists yet.
 */
export function useNotes() {
  const dayNotes = ref<DayNote[]>([])
  const weekNotes = ref<WeekNote[]>([])

  const loadNotes = async (): Promise<void> => {
    const [days, weeks] = await Promise.all([
      api.getDayNotes(),
      api.getWeekNotes(),
    ])
    dayNotes.value = days
    weekNotes.value = weeks
  }

  /**
   * Upserts the note for a single date. Empty strings are kept as an
   * explicit "cleared" state and pushed as a row so the next render
   * doesn't fall back to the empty default again.
   */
  const setDayNote = async (date: string, note: string): Promise<void> => {
    await api.setDayNote({ date, note })
    const idx = dayNotes.value.findIndex(d => d.date === date)
    if (idx !== -1) {
      dayNotes.value[idx] = { date, note }
    } else {
      dayNotes.value.push({ date, note })
    }
  }

  /**
   * Upserts the note for the week containing `weekStart`. `weekStart` is
   * the ISO date of the Monday of the target week.
   */
  const setWeekNote = async (weekStart: string, note: string): Promise<void> => {
    await api.setWeekNote({ weekStart, note })
    const idx = weekNotes.value.findIndex(w => w.weekStart === weekStart)
    if (idx !== -1) {
      weekNotes.value[idx] = { weekStart, note }
    } else {
      weekNotes.value.push({ weekStart, note })
    }
  }

  /**
   * Returns the note string for `date`, or `''` when no row exists yet.
   * Returned as a fresh string so callers can safely bind it to inputs.
   */
  function getDayNote(date: string): string {
    return dayNotes.value.find(d => d.date === date)?.note ?? ''
  }

  function getWeekNote(weekStart: string): string {
    return weekNotes.value.find(w => w.weekStart === weekStart)?.note ?? ''
  }

  return {
    dayNotes,
    weekNotes,
    loadNotes,
    setDayNote,
    setWeekNote,
    getDayNote,
    getWeekNote,
  }
}
