<script setup lang="ts">
import type { Project } from '../../types'

defineProps<{
  projects: Project[]
  selectedProject: string
  /** Map of `projectId → active task count` (cancelled excluded). */
  taskCounts: Record<string, number>
  /** Total active tasks across all projects; shown next to "All Tasks". */
  totalActiveTasks: number
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'add'): void
}>()
</script>

<template>
  <div class="project-list">
    <div
      class="project-item"
      :class="{ active: selectedProject === 'all' }"
      role="button"
      tabindex="0"
      @click="emit('select', 'all')"
      @keydown.enter.prevent="emit('select', 'all')"
      @keydown.space.prevent="emit('select', 'all')"
    >
      <div class="project-dot" style="background: var(--text-secondary)"></div>
      <span class="project-name">All Tasks</span>
      <span class="project-count">{{ totalActiveTasks }}</span>
    </div>
    <div
      v-for="project in projects"
      :key="project.id"
      class="project-item"
      :class="{ active: selectedProject === project.id }"
      role="button"
      tabindex="0"
      @click="emit('select', project.id)"
      @keydown.enter.prevent="emit('select', project.id)"
      @keydown.space.prevent="emit('select', project.id)"
    >
      <div class="project-dot" :style="{ background: project.color }"></div>
      <span class="project-name">{{ project.name }}</span>
      <span class="project-count">{{ taskCounts[project.id] ?? 0 }}</span>
    </div>
  </div>
  <button class="add-btn" type="button" @click="emit('add')">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
    Add Project
  </button>
</template>

<style scoped>
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
  user-select: none;
}

.project-item:hover {
  background: var(--bg);
}

.project-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
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
  font-family: inherit;
}

.add-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.add-btn svg {
  width: 16px;
  height: 16px;
}
</style>
