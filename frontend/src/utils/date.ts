/**
 * Date helpers used by the week-view navigation and headers.
 *
 * Kept pure (no Vue reactivity) so they can be reused inside composables,
 * computeds, and tests without dragging the reactivity system along.
 */

/** A single day cell in the week grid. */
export interface WeekDay {
  /** ISO date string (`YYYY-MM-DD`) — stable for keys and API calls. */
  date: string
  /** Short weekday label, e.g. "Mon". */
  name: string
  /** Day-of-month number, e.g. `7`. */
  dayNum: number
  /** True when this calendar day is today (local timezone). */
  isToday: boolean
}

/**
 * Returns the Monday of the week containing `date` at local midnight.
 * Sunday is treated as the *last* day of the previous week (ISO 8601).
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Produces seven `WeekDay` entries starting from `weekStartStr`. `weekStartStr`
 * is an ISO date (`YYYY-MM-DD`); it is parsed in the local timezone, not UTC,
 * because the planner is week-of-the-calendar-day based.
 */
export function getWeekDays(weekStartStr: string): WeekDay[] {
  const days: WeekDay[] = []
  const start = new Date(weekStartStr)
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    days.push({
      date: d.toISOString().split('T')[0],
      name: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: d.getDate(),
      isToday: d.toDateString() === new Date().toDateString(),
    })
  }
  return days
}

/**
 * Human-readable header for the week navigation, e.g. `Mar 4 - 10, 2024`.
 * Crosses months without doubling the year string.
 */
export function formatWeekDisplay(weekStartStr: string): string {
  const start = new Date(weekStartStr)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' })
  const year = start.getFullYear()

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()} - ${end.getDate()}, ${year}`
  }
  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${year}`
}
