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

export interface State {
  projects: Project[]
  tasks: Task[]
  properties: Property[]
  propertyValues: PropertyValue[]
  dayNotes: DayNote[]
  weekNotes: WeekNote[]
}
