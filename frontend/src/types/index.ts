export interface Project {
  id: string
  name: string
  color: string
  createdAt: number
  updatedAt: number
}

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  date: string
  status: 'active' | 'completed' | 'cancelled'
  notes: string
  createdAt: number
  updatedAt: number
}

export interface Property {
  id: string
  name: string
  unit: string
  createdAt: number
  updatedAt: number
}

export interface PropertyValue {
  id: string
  propertyId: string
  date: string
  value: number
}

export interface DayNote {
  date: string
  note: string
}

export interface WeekNote {
  weekStart: string
  note: string
}

/**
 * Numeric day-of-week matching `Date#getDay()`: 0 = Sunday, ..., 6 =
 * Saturday. Mirrored on the frontend so the client and backend agree
 * on the wire format.
 */
export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6

/**
 * Which calendar the UI renders. Storage is always Gregorian ISO
 * (`YYYY-MM-DD`); the choice only affects display (date headers,
 * day-of-month numbers, the `TaskModal` date picker).
 *
 * - `'gregorian'` — the default; no conversion happens.
 * - `'jalali'` — Persian/Jalali. Dates are converted for display and
 *   the date picker switches to a Jalali grid, but the wire format
 *   stays Gregorian.
 */
export type Calendar = 'gregorian' | 'jalali'

/**
 * User's *choice* for the theme setting. Persisted in `localStorage`
 * and exposed in the settings UI. The actual applied theme is a
 * subset of this — see `ResolvedTheme`.
 *
 * - `'light'` — force the light palette.
 * - `'dark'` — force the dark palette.
 * - `'system'` — track `prefers-color-scheme` and follow it.
 */
export type Theme = 'light' | 'dark' | 'system'

/**
 * The theme actually applied to the document. Always a concrete
 * `light` / `dark` — never `'system'`, because the OS preference is
 * resolved at the boundary (see `utils/theme.ts#resolveTheme`) and
 * the rest of the app only deals with the applied value.
 */
export type ResolvedTheme = 'light' | 'dark'

/**
 * User-facing settings. The full object is the unit of write — the
 * PUT endpoint replaces the persisted settings wholesale, which is
 * fine because the set of keys is small and known.
 */
export interface Settings {
  /** Which day the week starts on. Default: Saturday (6). */
  weekStart: WeekStartDay
  /** Which calendar to render. Default: 'gregorian'. */
  calendar: Calendar
}

export interface State {
  projects: Project[]
  tasks: Task[]
  properties: Property[]
  propertyValues: PropertyValue[]
  dayNotes: DayNote[]
  weekNotes: WeekNote[]
  settings: Settings
}

// Auth types
export interface AuthStatus {
  setupRequired: boolean
  /**
   * True when the calling session is already authenticated (i.e. the
   * user has logged in and the session cookie is still within its
   * window). The client uses this on boot to skip the login screen
   * for returning users.
   */
  authenticated: boolean
}

export interface AuthChangePasswordRequest {
  currentPassword: string
  newPassword: string
}
