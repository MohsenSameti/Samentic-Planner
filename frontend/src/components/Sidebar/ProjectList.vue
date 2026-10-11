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
  (e: 'edit', project: Project): void
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
      <button
        type="button"
        class="project-edit-btn"
        :aria-label="`Edit ${project.name}`"
        title="Edit project"
        @click.stop="emit('edit', project)"
        @keydown.enter.stop
        @keydown.space.stop
      >
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
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
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
  gap: var(--space-1);
}

.project-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
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
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px dashed var(--border);
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  width: 100%;
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-top: var(--space-2);
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

.project-edit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  min-width: 24px;
  min-height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
  flex-shrink: 0;
}

.project-item:hover .project-edit-btn,
.project-edit-btn:focus-visible {
  opacity: 1;
}

.project-edit-btn:hover {
  opacity: 1;
  color: var(--text-primary);
  background: var(--surface);
}

.project-edit-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.project-edit-btn svg {
  width: 14px;
  height: 14px;
}

@media (max-width: 1024px) {
  .project-edit-btn {
    width: 32px;
    height: 32px;
    min-width: 32px;
    min-height: 32px;
    opacity: 0.9;
  }

  .project-edit-btn svg {
    width: 16px;
    height: 16px;
  }
}
</style>
