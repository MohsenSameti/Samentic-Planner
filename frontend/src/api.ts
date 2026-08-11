import type { Project, Task, Property, PropertyValue, DayNote, WeekNote, State } from './types'

const API = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const api = {
  // Projects
  getProjects: () => request<Project[]>('/projects'),
  createProject: (data: Omit<Project, 'createdAt' | 'updatedAt'>) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: string, data: Partial<Project>) =>
    request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: string) =>
    request<{ success: boolean }>('/projects/' + id, { method: 'DELETE' }),

  // Tasks
  getTasks: () => request<Task[]>('/tasks'),
  createTask: (data: Omit<Task, 'createdAt' | 'updatedAt'>) =>
    request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: string, data: Partial<Task>) =>
    request<Task>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTask: (id: string) =>
    request<{ success: boolean }>('/tasks/' + id, { method: 'DELETE' }),

  // Properties
  getProperties: () => request<Property[]>('/properties'),
  createProperty: (data: Omit<Property, 'createdAt' | 'updatedAt'>) =>
    request<Property>('/properties', { method: 'POST', body: JSON.stringify(data) }),
  updateProperty: (id: string, data: Partial<Property>) =>
    request<Property>(`/properties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProperty: (id: string) =>
    request<{ success: boolean }>('/properties/' + id, { method: 'DELETE' }),

  // Property Values
  getPropertyValues: () => request<PropertyValue[]>('/property-values'),
  setPropertyValue: (data: Omit<PropertyValue, 'id'> & { id?: string }) =>
    request<PropertyValue>('/property-values', { method: 'POST', body: JSON.stringify(data) }),

  // Day Notes
  getDayNotes: () => request<DayNote[]>('/day-notes'),
  setDayNote: (data: DayNote) =>
    request<DayNote>('/day-notes', { method: 'POST', body: JSON.stringify(data) }),

  // Week Notes
  getWeekNotes: () => request<WeekNote[]>('/week-notes'),
  setWeekNote: (data: WeekNote) =>
    request<WeekNote>('/week-notes', { method: 'POST', body: JSON.stringify(data) }),

  // Full State
  getState: () => request<State>('/state')
}
