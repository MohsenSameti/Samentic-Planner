<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../composables/useI18n'
import type { Calendar, Language, Project, Property, Task, Theme, WeekStartDay } from '../../types'
import ProjectList from './ProjectList.vue'
import PropertiesSection from './PropertiesSection.vue'
import SettingsSection from './SettingsSection.vue'

/**
 * `Property` augmented with a `sum` for the current week. Computed in
 * `App.vue` and passed in ready-to-render so this component stays a
 * pure presentation layer.
 */
export type PropertyWithSum = Property & { sum: number }

const { t } = useI18n()

const props = withDefaults(defineProps<{
  projects: Project[]
  properties: Property[]
  tasks: Task[]
  selectedProject: string
  weeklyPropertySums: PropertyWithSum[]
  /** Current theme choice (persisted in localStorage, applied to <html>). */
  theme: Theme
  /** Current start-of-week setting (0=Sunday..6=Saturday). */
  weekStart: WeekStartDay
  /** Current calendar preference. */
  calendar: Calendar
  /** Current interface language. */
  language?: Language
  /**
   * When `true`, the sidebar is visually collapsed (width: 0 on desktop,
   * slid off-screen on mobile) but stays in the DOM so the transition
   * can animate. The parent still owns the open/closed state.
   */
  collapsed: boolean
}>(), {
  language: 'en',
})

const emit = defineEmits<{
  (e: 'select-project', id: string): void
  (e: 'add-project'): void
  (e: 'edit-project', project: Project): void
  (e: 'add-property'): void
  (e: 'edit-property', property: Property): void
  (e: 'change-theme', t: Theme): void
  (e: 'change-week-start', day: WeekStartDay): void
  (e: 'change-calendar', c: Calendar): void
  (e: 'change-language', language: Language): void
}>()

/**
 * Aggregate the *active* task counts per project for the sidebar
 * chips. Cancelled tasks are excluded so the count reflects work
 * that's actually pending.
 */
const taskCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {}
  for (const task of props.tasks) {
    if (task.status === 'cancelled') continue
    counts[task.projectId] = (counts[task.projectId] ?? 0) + 1
  }
  return counts
})

const totalActiveTasks = computed<number>(() =>
  props.tasks.filter(t => t.status !== 'cancelled').length,
)
</script>

<template>
  <aside class="sidebar" :class="{ collapsed }">
    <section class="sidebar-section">
      <h3>{{ t('Projects') }}</h3>
      <ProjectList
        :projects="projects"
        :selected-project="selectedProject"
        :task-counts="taskCounts"
        :total-active-tasks="totalActiveTasks"
        @select="(id) => emit('select-project', id)"
        @add="emit('add-project')"
        @edit="(project) => emit('edit-project', project)"
      />
    </section>

    <section class="sidebar-section">
      <h3>{{ t('Custom Properties') }}</h3>
      <PropertiesSection
        :properties="properties"
        @add="emit('add-property')"
        @edit="(property) => emit('edit-property', property)"
      />
    </section>

    <section v-if="weeklyPropertySums.length > 0" class="sidebar-section">
      <h3>{{ t('Weekly Totals') }}</h3>
      <div class="property-sums">
        <div v-for="prop in weeklyPropertySums" :key="prop.id" class="sum-card">
          <div class="sum-value">{{ prop.sum }}</div>
          <div class="sum-label">{{ prop.name }}</div>
        </div>
      </div>
    </section>

    <section class="sidebar-section">
      <h3>{{ t('Settings') }}</h3>
      <SettingsSection
        :theme="theme"
        :week-start="weekStart"
        :calendar="calendar"
        :language="language"
        @change-theme="(t) => emit('change-theme', t)"
        @change-week-start="(day) => emit('change-week-start', day)"
        @change-calendar="(c) => emit('change-calendar', c)"
        @change-language="(next) => emit('change-language', next)"
      />
    </section>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 280px;
  background: var(--surface);
  border-inline-end: 1px solid var(--border);
  padding: var(--space-6);
  overflow-y: auto;
  transition: width 0.2s ease, padding 0.2s ease;
  flex-shrink: 0;
}

.sidebar.collapsed {
  width: 0;
  padding: 0;
  overflow: hidden;
}

.sidebar-section {
  margin-bottom: var(--space-8);
}

.sidebar-section h3 {
  font-size: 0.75rem;
  font-weight: 600;
  /* upper labels removed per design spec */
  /*  */
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  margin-bottom: var(--space-3);
}

.property-sums {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.sum-card {
  background: var(--bg);
  padding: var(--space-3);
  border-radius: 6px;
  text-align: center;
}

.sum-card .sum-value {
  font-family: var(--font-heading);
  font-size: 1.25rem;
  font-weight: 500;
  color: var(--accent);
}

.sum-card .sum-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  /* upper labels removed per design spec */
  /*  */
  margin-top: var(--space-1);
}

@media (max-width: 1024px) {
  .sidebar {
    position: fixed;
    inset-inline-start: 0;
    top: 0;
    bottom: 0;
    height: 100dvh;
    z-index: 150;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
  }

  :root[dir="rtl"] .sidebar {
    transform: translateX(100%);
  }

  :root[dir="rtl"] .sidebar:not(.collapsed) {
    transform: translateX(0);
  }

  .sidebar:not(.collapsed) {
    transform: translateX(0);
    box-shadow: var(--shadow-md);
  }
}
</style>
