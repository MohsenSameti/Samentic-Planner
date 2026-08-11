<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from './api'
import type { Project, Task, Property, PropertyValue, DayNote, WeekNote } from './types'

const PROJECT_COLORS = [
  '#E74C3C', '#3498DB', '#9B59B6', '#1ABC9C',
  '#F39C12', '#E91E63', '#00BCD4', '#8BC34A'
]

// State
const projects = ref<Project[]>([])
const tasks = ref<Task[]>([])
const properties = ref<Property[]>([])
const propertyValues = ref<PropertyValue[]>([])
const dayNotes = ref<DayNote[]>([])
const weekNotes = ref<WeekNote[]>([])

const selectedProject = ref<string>('all')
const currentWeekStart = ref(getWeekStart(new Date()).toISOString().split('T')[0])
const sidebarCollapsed = ref(true)
const loading = ref(true)

// Modals
const taskModal = ref(false)
const projectModal = ref(false)
const propertyModal = ref(false)
const moveModal = ref(false)
const deleteModal = ref(false)

const editingTask = ref<Task | null>(null)
const editingProject = ref<Project | null>(null)
const editingProperty = ref<Property | null>(null)
const movingTask = ref<Task | null>(null)
const deletingItem = ref<{ type: string; item: Project | Property; callback: () => void } | null>(null)
const selectedColor = ref(PROJECT_COLORS[0])

// Form data
const taskForm = ref({ title: '', description: '', projectId: '', date: '' })
const expandedNotes = ref<Set<string>>(new Set())
const expandedDayNotes = ref<Set<string>>(new Set())
const openMenuTaskId = ref<string | null>(null)
const menuPosition = ref({ top: 0, left: 0 })
const projectForm = ref({ name: '', color: '' })
const propertyForm = ref({ name: '', unit: '' })
const moveDate = ref('')
const deleteMessage = ref('')

// Computed
const weekDays = computed(() => getWeekDays(currentWeekStart.value))
const weekStart = computed(() => currentWeekStart.value)

const filteredTasks = computed(() => {
  if (selectedProject.value === 'all') return tasks.value
  return tasks.value.filter(t => t.projectId === selectedProject.value)
})

const weekSummary = computed(() => {
  const dayStrs = weekDays.value.map(d => d.date)
  const weekTasks = tasks.value.filter(t => dayStrs.includes(t.date))
  return {
    completed: weekTasks.filter(t => t.status === 'completed').length,
    active: weekTasks.filter(t => t.status === 'active').length,
    cancelled: weekTasks.filter(t => t.status === 'cancelled').length
  }
})

const weeklyPropertySums = computed(() => {
  const dayStrs = weekDays.value.map(d => d.date)
  return properties.value.map(prop => {
    const sum = propertyValues.value
      .filter(pv => pv.propertyId === prop.id && dayStrs.includes(pv.date))
      .reduce((acc, pv) => acc + pv.value, 0)
    return { ...prop, sum }
  })
})

// Utility functions
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekDays(weekStartStr: string) {
  const days = []
  const start = new Date(weekStartStr)
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    days.push({
      date: d.toISOString().split('T')[0],
      name: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: d.getDate(),
      isToday: d.toDateString() === new Date().toDateString()
    })
  }
  return days
}

function formatWeekDisplay() {
  const start = new Date(currentWeekStart.value)
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

function getProject(id: string | null) {
  return projects.value.find(p => p.id === id)
}

function getTasksForDay(date: string) {
  return filteredTasks.value.filter(t => t.date === date)
}

function getDayNote(date: string) {
  return dayNotes.value.find(d => d.date === date)?.note || ''
}

function getWeekNote() {
  return weekNotes.value.find(w => w.weekStart === weekStart.value)?.note || ''
}

function getPropertyValues(date: string) {
  return propertyValues.value.filter(pv => pv.date === date)
}

function getTaskCounts() {
  const counts: Record<string, number> = {}
  tasks.value.filter(t => t.status !== 'cancelled').forEach(t => {
    counts[t.projectId] = (counts[t.projectId] || 0) + 1
  })
  return counts
}

// Navigation
function navigateWeek(dir: number) {
  const d = new Date(currentWeekStart.value)
  d.setDate(d.getDate() + dir * 7)
  currentWeekStart.value = d.toISOString().split('T')[0]
}

function goToToday() {
  currentWeekStart.value = getWeekStart(new Date()).toISOString().split('T')[0]
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function closeSidebar() {
  sidebarCollapsed.value = true
}

// Task actions
function openTaskModal(date: string, task?: Task) {
  if (task) {
    editingTask.value = task
    taskForm.value = { title: task.title, description: task.description || '', projectId: task.projectId, date: task.date }
  } else {
    editingTask.value = null
    taskForm.value = { title: '', description: '', projectId: projects.value[0]?.id || '', date }
  }
  taskModal.value = true
}

async function saveTask() {
  if (!taskForm.value.title.trim()) return
  
  if (editingTask.value) {
    await api.updateTask(editingTask.value.id, {
      title: taskForm.value.title,
      description: taskForm.value.description,
      projectId: taskForm.value.projectId,
      date: taskForm.value.date
    })
    const idx = tasks.value.findIndex(t => t.id === editingTask.value!.id)
    if (idx !== -1) {
      tasks.value[idx] = { ...tasks.value[idx], ...taskForm.value, updatedAt: Date.now() }
    }
  } else {
    const task = await api.createTask({
      id: generateId(),
      title: taskForm.value.title,
      description: taskForm.value.description,
      projectId: taskForm.value.projectId,
      date: taskForm.value.date,
      status: 'active',
      notes: ''
    })
    tasks.value.push(task)
  }
  
  taskModal.value = false
}

async function toggleTaskStatus(task: Task) {
  const newStatus = task.status === 'active' ? 'completed' : 'active'
  await api.updateTask(task.id, { status: newStatus })
  task.status = newStatus
  task.updatedAt = Date.now()
}

async function cancelTask(task: Task) {
  await api.updateTask(task.id, { status: 'cancelled' })
  task.status = 'cancelled'
  task.updatedAt = Date.now()
}

async function restoreTask(task: Task) {
  await api.updateTask(task.id, { status: 'active' })
  task.status = 'active'
  task.updatedAt = Date.now()
}

async function deleteTask(task: Task) {
  await api.deleteTask(task.id)
  tasks.value = tasks.value.filter(t => t.id !== task.id)
}

function openMoveModal(task: Task) {
  movingTask.value = task
  moveDate.value = task.date
  moveModal.value = true
}

async function moveTask() {
  if (!movingTask.value) return
  await api.updateTask(movingTask.value.id, { date: moveDate.value })
  movingTask.value.date = moveDate.value
  movingTask.value.updatedAt = Date.now()
  moveModal.value = false
}

async function updateTaskNotes(task: Task, notes: string) {
  await api.updateTask(task.id, { notes })
  task.notes = notes
  task.updatedAt = Date.now()
}

function toggleTaskNotes(taskId: string) {
  if (expandedNotes.value.has(taskId)) {
    expandedNotes.value.delete(taskId)
  } else {
    expandedNotes.value.add(taskId)
  }
  // Trigger reactivity
  expandedNotes.value = new Set(expandedNotes.value)
}

function toggleDayNotes(date: string) {
  if (expandedDayNotes.value.has(date)) {
    expandedDayNotes.value.delete(date)
  } else {
    expandedDayNotes.value.add(date)
  }
  // Trigger reactivity
  expandedDayNotes.value = new Set(expandedDayNotes.value)
}

function toggleTaskMenu(taskId: string, event: MouseEvent) {
  event.stopPropagation()
  if (openMenuTaskId.value === taskId) {
    openMenuTaskId.value = null
  } else {
    const btn = event.currentTarget as HTMLElement
    const rect = btn.getBoundingClientRect()
    const menuWidth = 160
    const menuHeight = 180 // Approximate height of menu
    
    let left = rect.right - menuWidth
    let top = rect.bottom + 4
    
    // Adjust if menu would go off right edge
    if (left < 8) {
      left = 8
    }
    // Adjust if menu would go off bottom edge
    if (top + menuHeight > window.innerHeight - 8) {
      top = rect.top - menuHeight - 4
    }
    
    menuPosition.value = { top, left }
    openMenuTaskId.value = taskId
  }
}

function closeTaskMenu() {
  openMenuTaskId.value = null
}

// Close menu when clicking outside
function handleGlobalClick() {
  if (openMenuTaskId.value !== null) {
    openMenuTaskId.value = null
  }
}

// Day notes
async function updateDayNote(date: string, note: string) {
  await api.setDayNote({ date, note })
  const idx = dayNotes.value.findIndex(d => d.date === date)
  if (idx !== -1) {
    dayNotes.value[idx].note = note
  } else if (note) {
    dayNotes.value.push({ date, note })
  }
}

// Week notes
async function updateWeekNote(note: string) {
  await api.setWeekNote({ weekStart: weekStart.value, note })
  const idx = weekNotes.value.findIndex(w => w.weekStart === weekStart.value)
  if (idx !== -1) {
    weekNotes.value[idx].note = note
  } else if (note) {
    weekNotes.value.push({ weekStart: weekStart.value, note })
  }
}

// Property values
async function updatePropertyValue(date: string, propertyId: string, value: number) {
  await api.setPropertyValue({ propertyId, date, value })
  const idx = propertyValues.value.findIndex(
    pv => pv.date === date && pv.propertyId === propertyId
  )
  if (idx !== -1) {
    if (value) {
      propertyValues.value[idx].value = value
    } else {
      propertyValues.value.splice(idx, 1)
    }
  } else if (value) {
    propertyValues.value.push({ id: generateId(), propertyId, date, value })
  }
}

// Project actions
function openProjectModal(project?: Project) {
  if (project) {
    editingProject.value = project
    projectForm.value = { name: project.name, color: project.color }
    selectedColor.value = project.color
  } else {
    editingProject.value = null
    projectForm.value = { name: '', color: PROJECT_COLORS[0] }
    selectedColor.value = PROJECT_COLORS[0]
  }
  projectModal.value = true
}

async function saveProject() {
  if (!projectForm.value.name.trim()) return
  
  if (editingProject.value) {
    await api.updateProject(editingProject.value.id, {
      name: projectForm.value.name,
      color: selectedColor.value
    })
    const idx = projects.value.findIndex(p => p.id === editingProject.value!.id)
    if (idx !== -1) {
      projects.value[idx] = { ...projects.value[idx], ...projectForm.value, color: selectedColor.value, updatedAt: Date.now() }
    }
  } else {
    const project = await api.createProject({
      id: generateId(),
      name: projectForm.value.name,
      color: selectedColor.value
    })
    projects.value.push(project)
  }
  
  projectModal.value = false
}

function confirmDeleteProject(project: Project) {
  const taskCount = tasks.value.filter(t => t.projectId === project.id).length
  deleteMessage.value = taskCount > 0
    ? `Delete "${project.name}"? ${taskCount} tasks will be moved to no project.`
    : `Delete "${project.name}"?`
  deletingItem.value = {
    type: 'project',
    item: project,
    callback: async () => {
      await api.deleteProject(project.id)
      projects.value = projects.value.filter(p => p.id !== project.id)
      tasks.value.forEach(t => {
        if (t.projectId === project.id) t.projectId = ''
      })
    }
  }
  deleteModal.value = true
}

// Property actions
function openPropertyModal(property?: Property) {
  if (property) {
    editingProperty.value = property
    propertyForm.value = { name: property.name, unit: property.unit }
  } else {
    editingProperty.value = null
    propertyForm.value = { name: '', unit: '' }
  }
  propertyModal.value = true
}

async function saveProperty() {
  if (!propertyForm.value.name.trim()) return
  
  if (editingProperty.value) {
    await api.updateProperty(editingProperty.value.id, propertyForm.value)
    const idx = properties.value.findIndex(p => p.id === editingProperty.value!.id)
    if (idx !== -1) {
      properties.value[idx] = { ...properties.value[idx], ...propertyForm.value, updatedAt: Date.now() }
    }
  } else {
    const prop = await api.createProperty({
      id: generateId(),
      ...propertyForm.value
    })
    properties.value.push(prop)
  }
  
  propertyModal.value = false
}

function confirmDeleteProperty(property: Property) {
  deleteMessage.value = `Delete "${property.name}"? All values will be removed.`
  deletingItem.value = {
    type: 'property',
    item: property,
    callback: async () => {
      await api.deleteProperty(property.id)
      properties.value = properties.value.filter(p => p.id !== property.id)
      propertyValues.value = propertyValues.value.filter(pv => pv.propertyId !== property.id)
    }
  }
  deleteModal.value = true
}

async function executeDelete() {
  if (deletingItem.value) {
    deletingItem.value.callback()
  }
  deleteModal.value = false
}

// Drag and drop
function onDragStart(e: DragEvent, task: Task) {
  if (task.status === 'cancelled') {
    e.preventDefault()
    return
  }
  e.dataTransfer!.setData('text/plain', task.id)
}

async function onDrop(e: DragEvent, date: string) {
  e.preventDefault()
  const taskId = e.dataTransfer!.getData('text/plain')
  const task = tasks.value.find(t => t.id === taskId)
  if (task) {
    await api.updateTask(task.id, { date })
    task.date = date
    task.updatedAt = Date.now()
  }
}

// Load data
onMounted(async () => {
  // Add global click listener to close menus
  document.addEventListener('click', handleGlobalClick)
  
  // Collapse sidebar on mobile by default
  if (window.innerWidth <= 1024) {
    sidebarCollapsed.value = true
  }
  
  try {
    const state = await api.getState()
    projects.value = state.projects
    tasks.value = state.tasks
    properties.value = state.properties
    propertyValues.value = state.propertyValues
    dayNotes.value = state.dayNotes
    weekNotes.value = state.weekNotes
    
    // Create default project if none exist
    if (projects.value.length === 0) {
      const project = await api.createProject({
        id: generateId(),
        name: 'General',
        color: PROJECT_COLORS[0]
      })
      projects.value.push(project)
    }
  } catch (err) {
    console.error('Failed to load data:', err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="app" v-if="!loading">
    <!-- Header -->
    <header class="header">
      <div class="header-left">
        <!-- Mobile Sidebar Toggle -->
        <button class="sidebar-toggle" @click="toggleSidebar" aria-label="Toggle menu">
          <svg v-if="sidebarCollapsed" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <div class="logo">
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="6" width="26" height="23" rx="3" stroke="currentColor" stroke-width="2" fill="none"/>
            <line x1="3" y1="12" x2="29" y2="12" stroke="currentColor" stroke-width="2"/>
            <line x1="9" y1="3" x2="9" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <line x1="23" y1="3" x2="23" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <h1>Planner</h1>
        </div>
        <nav class="week-nav">
          <button class="nav-btn" @click="navigateWeek(-1)" aria-label="Previous week">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <span class="week-display">{{ formatWeekDisplay() }}</span>
          <button class="nav-btn" @click="navigateWeek(1)" aria-label="Next week">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
          <button class="today-btn" @click="goToToday">Today</button>
        </nav>
      </div>
    </header>

    <div class="main-container">
      <!-- Sidebar -->
      <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
        <section class="sidebar-section">
          <h3>Projects</h3>
          <div class="project-list">
            <div 
              class="project-item" 
              :class="{ active: selectedProject === 'all' }"
              @click="selectedProject = 'all'"
            >
              <div class="project-dot" style="background: var(--text-secondary)"></div>
              <span class="project-name">All Tasks</span>
              <span class="project-count">{{ tasks.filter(t => t.status !== 'cancelled').length }}</span>
            </div>
            <div 
              v-for="project in projects" 
              :key="project.id"
              class="project-item" 
              :class="{ active: selectedProject === project.id }"
              @click="selectedProject = project.id"
            >
              <div class="project-dot" :style="{ background: project.color }"></div>
              <span class="project-name">{{ project.name }}</span>
              <span class="project-count">{{ getTaskCounts()[project.id] || 0 }}</span>
            </div>
          </div>
          <button class="add-btn" @click="openProjectModal()">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add Project
          </button>
        </section>

        <section class="sidebar-section" v-if="properties.length > 0">
          <h3>Custom Properties</h3>
          <div class="project-list">
            <div v-for="prop in properties" :key="prop.id" class="property-item">
              <span>{{ prop.name }}</span>
              <span class="property-unit">{{ prop.unit }}</span>
            </div>
          </div>
          <button class="add-btn" @click="openPropertyModal()">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add Property
          </button>
        </section>

        <section class="sidebar-section" v-if="properties.length > 0">
          <h3>Weekly Totals</h3>
          <div class="property-sums">
            <div v-for="prop in weeklyPropertySums" :key="prop.id" class="sum-card">
              <div class="sum-value">{{ prop.sum }}</div>
              <div class="sum-label">{{ prop.name }}</div>
            </div>
          </div>
        </section>
      </aside>

      <!-- Mobile Sidebar Backdrop -->
      <div 
        v-if="!sidebarCollapsed" 
        class="sidebar-backdrop" 
        @click="closeSidebar"
      ></div>

      <!-- Main Content -->
      <main class="week-container">
        <div class="week-grid">
          <div 
            v-for="day in weekDays" 
            :key="day.date" 
            class="day-column"
            :class="{ today: day.isToday }"
            @dragover.prevent
            @drop="onDrop($event, day.date)"
          >
            <div class="day-header">
              <div>
                <div class="day-name">{{ day.name }}</div>
                <div class="day-date">{{ day.dayNum }}</div>
              </div>
              <button class="add-task-btn" @click="openTaskModal(day.date)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
            </div>

            <div class="task-list">
              <template v-for="task in getTasksForDay(day.date)" :key="task.id">
                <div 
                  class="task-card"
                  :class="{ completed: task.status === 'completed', cancelled: task.status === 'cancelled' }"
                  :draggable="task.status !== 'cancelled'"
                  @dragstart="onDragStart($event, task)"
                >
                  <div class="task-main">
                    <div 
                      class="task-checkbox" 
                      :class="{ checked: task.status === 'completed' }"
                      @click="toggleTaskStatus(task)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <div class="task-content">
                      <div class="task-title">{{ task.title }}</div>
                      <div class="task-description" v-if="task.description">{{ task.description }}</div>
                      <div class="task-project" v-if="getProject(task.projectId)">
                        <div class="task-project-dot" :style="{ background: getProject(task.projectId)!.color }"></div>
                        <span class="task-project-name">{{ getProject(task.projectId)!.name }}</span>
                      </div>
                    </div>
                    <div class="task-menu-wrapper">
                      <button class="task-menu-btn" @click="toggleTaskMenu(task.id, $event)">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                      </button>
                      <div class="task-menu" :class="{ open: openMenuTaskId === task.id }" :style="{ top: menuPosition.top + 'px', left: menuPosition.left + 'px' }" @click.stop>
                        <template v-if="task.status !== 'cancelled'">
                          <div class="task-menu-item" @click="openTaskModal(day.date, task); closeTaskMenu()">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            Edit
                          </div>
                          <div class="task-menu-item" @click="toggleTaskNotes(task.id); closeTaskMenu()">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            {{ expandedNotes.has(task.id) ? 'Hide Notes' : 'Add Notes' }}
                          </div>
                          <div class="task-menu-item" @click="openMoveModal(task); closeTaskMenu()">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>
                            Move to...
                          </div>
                          <div class="task-menu-item danger" @click="cancelTask(task); closeTaskMenu()">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                            Cancel
                          </div>
                        </template>
                        <template v-else>
                          <div class="task-menu-item" @click="restoreTask(task); closeTaskMenu()">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
                            Restore
                          </div>
                          <div class="task-menu-item danger" @click="deleteTask(task); closeTaskMenu()">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            Delete
                          </div>
                        </template>
                      </div>
                    </div>
                  </div>
                  
                  <div class="task-notes" :class="{ expanded: expandedNotes.has(task.id) }">
                    <textarea 
                      :value="task.notes"
                      @blur="updateTaskNotes(task, ($event.target as HTMLTextAreaElement).value)"
                      placeholder="Add notes..."
                    ></textarea>
                  </div>
                </div>
              </template>

              <div class="empty-state" v-if="getTasksForDay(day.date).length === 0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <p>No tasks</p>
              </div>
            </div>

            <!-- Day Properties -->
            <div class="day-properties" v-if="properties.length > 0">
              <div v-for="prop in properties" :key="prop.id" class="property-row">
                <span class="property-label">{{ prop.name }}</span>
                <input 
                  type="number" 
                  class="property-input" 
                  :value="getPropertyValues(day.date).find(pv => pv.propertyId === prop.id)?.value || ''"
                  @change="updatePropertyValue(day.date, prop.id, parseFloat(($event.target as HTMLInputElement).value) || 0)"
                  placeholder="0"
                >
              </div>
            </div>

            <!-- Day Notes -->
            <div class="day-notes">
              <div class="day-notes-toggle" @click="toggleDayNotes(day.date)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                Day Notes
              </div>
              <div class="day-notes-content" :class="{ expanded: expandedDayNotes.has(day.date) }">
                <textarea 
                  :value="getDayNote(day.date)"
                  @blur="updateDayNote(day.date, ($event.target as HTMLTextAreaElement).value)"
                  placeholder="Add notes for this day..."
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        <!-- Week Notes -->
        <section class="week-notes-section">
          <h3>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            Week Notes
          </h3>
          <textarea 
            :value="getWeekNote()"
            @blur="updateWeekNote(($event.target as HTMLTextAreaElement).value)"
            placeholder="Add notes about this week..."
          ></textarea>
        </section>

        <!-- Week Summary -->
        <section class="week-summary">
          <h3>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            Week Summary
          </h3>
          <div class="summary-stats">
            <div class="stat-item">
              <div class="stat-value" style="color: var(--success)">{{ weekSummary.completed }}</div>
              <div class="stat-label">Completed</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ weekSummary.active }}</div>
              <div class="stat-label">Active</div>
            </div>
            <div class="stat-item">
              <div class="stat-value" style="color: var(--muted)">{{ weekSummary.cancelled }}</div>
              <div class="stat-label">Cancelled</div>
            </div>
            <div v-for="prop in weeklyPropertySums" :key="prop.id" class="stat-item">
              <div class="stat-value" style="color: var(--accent)">{{ prop.sum }}</div>
              <div class="stat-label">{{ prop.name }} {{ prop.unit }}</div>
            </div>
          </div>
        </section>
      </main>
    </div>

    <!-- Task Modal -->
    <div class="modal-overlay" :class="{ active: taskModal }" @click.self="taskModal = false">
      <div class="modal">
        <h2>{{ editingTask ? 'Edit Task' : 'Add Task' }}</h2>
        <form @submit.prevent="saveTask">
          <div class="form-group">
            <label>Task</label>
            <input v-model="taskForm.title" type="text" placeholder="What needs to be done?" required>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="taskForm.description" placeholder="Add a description..." rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>Project</label>
            <select v-model="taskForm.projectId">
              <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="taskModal = false">Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Project Modal -->
    <div class="modal-overlay" :class="{ active: projectModal }" @click.self="projectModal = false">
      <div class="modal">
        <h2>{{ editingProject ? 'Edit Project' : 'Add Project' }}</h2>
        <form @submit.prevent="saveProject">
          <div class="form-group">
            <label>Name</label>
            <input v-model="projectForm.name" type="text" placeholder="Project name" required>
          </div>
          <div class="form-group">
            <label>Color</label>
            <div class="color-picker">
              <div 
                v-for="color in PROJECT_COLORS" 
                :key="color"
                class="color-option"
                :class="{ selected: selectedColor === color }"
                :style="{ background: color }"
                @click="selectedColor = color"
              ></div>
            </div>
          </div>
          <div class="modal-actions">
            <button v-if="editingProject" type="button" class="btn btn-danger" @click="confirmDeleteProject(editingProject); projectModal = false">
              Delete
            </button>
            <button type="button" class="btn btn-secondary" @click="projectModal = false">Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Property Modal -->
    <div class="modal-overlay" :class="{ active: propertyModal }" @click.self="propertyModal = false">
      <div class="modal">
        <h2>{{ editingProperty ? 'Edit Property' : 'Add Property' }}</h2>
        <form @submit.prevent="saveProperty">
          <div class="form-group">
            <label>Name</label>
            <input v-model="propertyForm.name" type="text" placeholder="e.g., Hours, Pages" required>
          </div>
          <div class="form-group">
            <label>Unit</label>
            <input v-model="propertyForm.unit" type="text" placeholder="e.g., hrs, km">
          </div>
          <div class="modal-actions">
            <button v-if="editingProperty" type="button" class="btn btn-danger" @click="confirmDeleteProperty(editingProperty); propertyModal = false">
              Delete
            </button>
            <button type="button" class="btn btn-secondary" @click="propertyModal = false">Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Move Modal -->
    <div class="modal-overlay" :class="{ active: moveModal }" @click.self="moveModal = false">
      <div class="modal">
        <h2>Move Task</h2>
        <form @submit.prevent="moveTask">
          <div class="form-group">
            <label>Move to</label>
            <input v-model="moveDate" type="date" required>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="moveModal = false">Cancel</button>
            <button type="submit" class="btn btn-primary">Move</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div class="modal-overlay" :class="{ active: deleteModal }" @click.self="deleteModal = false">
      <div class="modal">
        <h2>Confirm Delete</h2>
        <p style="color: var(--text-secondary); margin-bottom: 20px;">{{ deleteMessage }}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="deleteModal = false">Cancel</button>
          <button class="btn btn-danger" @click="executeDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="loading">
    <p>Loading...</p>
  </div>
</template>

<style scoped>
/* Layout */
.app {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  height: 100dvh;
  overflow: hidden;
}

.header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 16px 24px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo svg {
  width: 32px;
  height: 32px;
}

.logo h1 {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  font-weight: normal;
}

.week-nav {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s ease;
}

.nav-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.nav-btn svg {
  width: 18px;
  height: 18px;
}

.week-display {
  font-family: var(--font-mono);
  font-size: 0.95rem;
  min-width: 180px;
  text-align: center;
}

.today-btn {
  padding: 8px 16px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
}

.today-btn:hover {
  background: #B84700;
}

.main-container {
  display: flex;
  flex: 1;
  overflow: visible;
}

/* Sidebar */
.sidebar {
  width: 280px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 24px;
  overflow-y: auto;
  transition: width 0.2s ease, padding 0.2s ease;
}

.sidebar.collapsed {
  width: 0;
  padding: 0;
  overflow: hidden;
}

.sidebar-toggle {
  display: flex;
  width: 40px;
  height: 40px;
  background: transparent;
  color: var(--text);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.sidebar-toggle:hover {
  background: var(--bg);
}

.sidebar-toggle svg {
  width: 22px;
  height: 22px;
}

.sidebar-section {
  margin-bottom: 32px;
}

.sidebar-section h3 {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.project-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s ease;
}

.project-item:hover {
  background: var(--bg);
}

.project-item.active {
  background: var(--accent-light);
}

.project-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.project-name {
  flex: 1;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-count {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.add-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px dashed var(--border);
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  width: 100%;
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-top: 8px;
}

.add-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.add-btn svg {
  width: 16px;
  height: 16px;
}

.property-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 0.9rem;
}

.property-unit {
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.property-sums {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 12px;
}

.sum-card {
  background: var(--bg);
  padding: 12px;
  border-radius: 6px;
  text-align: center;
}

.sum-card .sum-value {
  font-family: var(--font-mono);
  font-size: 1.25rem;
  font-weight: 500;
  color: var(--accent);
}

.sum-card .sum-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  margin-top: 2px;
}

/* Week Grid */
.week-container {
  flex: 1;
  padding: 24px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  height: calc(100vh - 73px);
}

.week-grid {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
  overflow-x: auto;
  padding-bottom: 8px;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  min-height: 300px;
}

.day-column {
  flex: 0 0 160px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  min-height: 300px;
  max-height: 500px;
  transition: border-color 0.15s ease;
  scroll-snap-align: start;
}

.day-column.today {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.day-header {
  padding: 12px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.day-name {
  font-weight: 600;
  font-size: 0.85rem;
}

.day-date {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.add-task-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: var(--accent-light);
  color: var(--accent);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s ease;
}

.add-task-btn:hover {
  background: var(--accent);
  color: white;
}

.add-task-btn svg {
  width: 16px;
  height: 16px;
}

.task-list {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
}

.task-card {
  background: var(--bg);
  border-radius: 6px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: grab;
}

.task-card:active {
  cursor: grabbing;
}

.task-card.completed {
  opacity: 0.6;
}

.task-card.completed .task-title {
  text-decoration: line-through;
  color: var(--text-secondary);
}

.task-card.cancelled {
  opacity: 0.4;
}

.task-card.cancelled .task-title {
  text-decoration: line-through;
  color: var(--muted);
}

.task-main {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.task-checkbox {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.1s ease;
  margin-top: 2px;
}

.task-checkbox:hover {
  border-color: var(--success);
}

.task-checkbox.checked {
  background: var(--success);
  border-color: var(--success);
}

.task-checkbox svg {
  width: 12px;
  height: 12px;
  color: white;
  opacity: 0;
}

.task-checkbox.checked svg {
  opacity: 1;
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: 0.875rem;
  font-weight: 500;
  word-break: break-word;
}

.task-description {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 4px;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-project {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

.task-project-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.task-project-name {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.task-menu-wrapper {
  position: relative;
}

.task-menu-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.1s ease;
}

.task-card:hover .task-menu-btn {
  opacity: 1;
}

/* Always show menu icon on mobile */
@media (max-width: 768px) {
  .task-menu-btn {
    opacity: 1;
  }
}

.task-menu-btn:hover {
  background: var(--border);
  color: var(--text-primary);
}

.task-menu-btn svg {
  width: 16px;
  height: 16px;
}

.task-menu {
  position: fixed;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  padding: 8px;
  min-width: 150px;
  z-index: 1000;
  display: none;
}

.task-menu.open {
  display: block;
}

.task-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.1s ease;
}

.task-menu-item:hover {
  background: var(--bg);
}

.task-menu-item svg {
  width: 16px;
  height: 16px;
  color: var(--text-secondary);
}

.task-menu-item.danger {
  color: #E74C3C;
}

.task-menu-item.danger svg {
  color: #E74C3C;
}

.task-notes {
  display: none;
  border-top: 1px solid var(--border);
  padding-top: 8px;
  margin-top: 8px;
}

.task-notes.expanded {
  display: block;
}

.task-notes textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 8px;
  font-size: 0.8rem;
  resize: vertical;
  min-height: 60px;
  background: var(--surface);
}

.task-notes textarea:focus {
  outline: none;
  border-color: var(--accent);
}

/* Day Properties */
.day-properties {
  border-top: 1px solid var(--border);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.property-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.property-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.property-input {
  width: 50px;
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  text-align: right;
}

.property-input:focus {
  outline: none;
  border-color: var(--accent);
}

/* Day Notes */
.day-notes {
  border-top: 1px solid var(--border);
  padding: 8px;
  flex-shrink: 0;
}

.day-notes-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.day-notes-toggle:hover {
  background: var(--bg);
}

.day-notes-toggle svg {
  width: 14px;
  height: 14px;
}

.day-notes-content {
  display: none;
  margin-top: 8px;
}

.day-notes-content.expanded {
  display: block;
}

.day-notes textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 8px;
  font-size: 0.8rem;
  resize: vertical;
  min-height: 50px;
  background: var(--surface);
}

.day-notes textarea:focus {
  outline: none;
  border-color: var(--accent);
}

/* Week Notes */
.week-notes-section,
.week-summary {
  margin-top: 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
}

.week-notes-section h3,
.week-summary h3 {
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.week-notes-section h3 svg,
.week-summary h3 svg {
  width: 18px;
  height: 18px;
  color: var(--accent);
}

.week-notes-section textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  font-size: 0.9rem;
  resize: vertical;
  min-height: 80px;
  background: var(--bg);
}

.week-notes-section textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.summary-stats {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-family: var(--font-mono);
  font-size: 1.5rem;
  font-weight: 500;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  color: var(--text-secondary);
  text-align: center;
  min-height: 150px;
}

.empty-state svg {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-state p {
  font-size: 0.9rem;
}

/* Loading */
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-size: 1.2rem;
  color: var(--text-secondary);
}

/* Sidebar Backdrop */
.sidebar-backdrop {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 140;
}

/* Responsive */
@media (max-width: 1024px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    height: 100dvh;
    z-index: 150;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
  }

  .sidebar:not(.collapsed) {
    transform: translateX(0);
    box-shadow: 4px 0 20px rgba(0,0,0,0.15);
  }

  .sidebar-backdrop {
    display: block;
    height: 100dvh;
  }
}

@media (max-width: 768px) {
  .header {
    padding: 12px 16px;
    overflow: visible;
  }

  .header-left {
    gap: 12px;
    flex-shrink: 0;
  }

  .logo h1 {
    font-size: 1.2rem;
  }

  .logo svg {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
  }

  .week-nav {
    flex-shrink: 0;
  }

  .week-display {
    font-size: 0.8rem;
    min-width: 130px;
  }

  .today-btn {
    padding: 6px 12px;
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .nav-btn {
    width: 32px;
    height: 32px;
  }

  .nav-btn svg {
    width: 16px;
    height: 16px;
  }

  .week-container {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
    height: calc(100dvh - 73px);
  }

  .week-grid {
    gap: 8px;
    margin: 0 -16px;
    padding: 0 16px 8px 16px;
    min-height: 250px;
  }

  .day-column {
    flex: 0 0 180px;
    min-height: 250px;
    max-height: 400px;
    overflow-y: auto;
  }

  .day-header {
    padding: 10px;
  }

  .day-name {
    font-size: 0.8rem;
  }

  .day-date {
    font-size: 0.75rem;
  }

  .sidebar-toggle {
    width: 40px;
    height: 40px;
  }

  .sidebar {
    width: 280px;
    height: 100dvh;
  }

  .sidebar-backdrop {
    height: 100dvh;
  }

  .header {
    height: auto;
    min-height: 60px;
  }
}
</style>
