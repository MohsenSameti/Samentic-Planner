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
 * User-facing settings. The full object is the unit of write — the
 * PUT endpoint replaces the persisted settings wholesale, which is
 * fine because the set of keys is small and known.
 */
export interface Settings {
  /** Which day the week starts on. Default: Saturday (6). */
  weekStart: WeekStartDay
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
