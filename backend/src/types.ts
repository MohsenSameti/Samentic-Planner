export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  date: string;
  status: 'active' | 'completed' | 'cancelled';
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface Property {
  id: string;
  name: string;
  unit: string;
  createdAt: number;
  updatedAt: number;
}

export interface PropertyValue {
  id: string;
  propertyId: string;
  date: string;
  value: number;
}

export interface DayNote {
  date: string;
  note: string;
}

export interface WeekNote {
  weekStart: string;
  note: string;
}

/**
 * Numeric day-of-week matching `Date#getDay()`: 0 = Sunday, ..., 6 =
 * Saturday. Stored as a number (not a string) so the value sorts
 * numerically and the type system keeps callers honest about the
 * valid range.
 */
export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Which calendar the UI renders. Storage is always Gregorian ISO
 * (`YYYY-MM-DD`); the choice only affects display on the frontend.
 * Mirrored on the server so the `Settings` round-trip is symmetric.
 */
export type Calendar = 'gregorian' | 'jalali';

/**
 * User-facing settings. Kept as a single object so new fields can be
 * added without churning the route surface — callers always PUT the
 * whole `Settings` (or a partial via a future PATCH if needed).
 */
export interface Settings {
  /** Which day the week starts on. Default: Saturday (6). */
  weekStart: WeekStartDay;
  /** Which calendar the UI should render. Default: 'gregorian'. */
  calendar: Calendar;
}

export interface State {
  projects: Project[];
  tasks: Task[];
  properties: Property[];
  propertyValues: PropertyValue[];
  dayNotes: DayNote[];
  weekNotes: WeekNote[];
  settings: Settings;
}
