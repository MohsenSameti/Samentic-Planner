<script setup lang="ts">
import { ref, watch } from 'vue'
import Modal from '../components/common/Modal.vue'
import JalaliDatePicker from '../components/common/JalaliDatePicker.vue'
import type { Calendar, Task, Project } from '../types'

const props = defineProps<{
  show: boolean
  /** When set, the modal is in "edit" mode; otherwise it's "create". */
  task: Task | null
  projects: Project[]
  /** Default date for new tasks. Ignored when `task` is set. */
  date: string
  /** Which calendar to render in the date field. */
  calendar: Calendar
}>()

const emit = defineEmits<{
  (e: 'close'): void
  /**
   * Emitted with the (possibly partial) task payload. The parent decides
   * whether to create or update based on whether `task` was set.
   */
  (e: 'save', payload: {
    id?: string
    title: string
    description: string
    projectId: string
    date: string
  }): void
}>()

/**
 * Local form state. Initialised from props but reset whenever the
 * upstream `task` or `date` changes — see `watch` below — so the
 * modal always reflects what the user opened it with.
 */
const form = ref<{
  title: string
  description: string
  projectId: string
  date: string
}>({
  title: props.task?.title ?? '',
  description: props.task?.description ?? '',
  projectId: props.task?.projectId ?? props.projects[0]?.id ?? '',
  date: props.task?.date ?? props.date,
})

watch(
  () => [props.task, props.date, props.projects] as const,
  ([nextTask, nextDate, nextProjects]) => {
    form.value = {
      title: nextTask?.title ?? '',
      description: nextTask?.description ?? '',
      projectId: nextTask?.projectId ?? nextProjects[0]?.id ?? '',
      date: nextTask?.date ?? nextDate,
    }
  },
  { immediate: true },
)

function onSubmit(): void {
  if (!form.value.title.trim()) return
  emit('save', {
    id: props.task?.id,
    title: form.value.title,
    description: form.value.description,
    projectId: form.value.projectId,
    date: form.value.date,
  })
}

/**
 * Handler for the Jalali picker's `update` event. Stores the
 * Gregorian ISO date string in the form state. The picker is the
 * only module that produces Jalali Y/M/D triples for output — here
 * we just receive the canonical Gregorian ISO and forward it.
 */
function onPickDate(value: string): void {
  form.value.date = value
}
</script>

<template>
  <Modal
    :show="show"
    :title="task ? 'Edit Task' : 'Add Task'"
    @close="emit('close')"
  >
    <form @submit.prevent="onSubmit">
      <div class="form-group">
        <label for="task-title">Task</label>
        <input
          id="task-title"
          v-model="form.title"
          type="text"
          placeholder="What needs to be done?"
          required
        />
      </div>
      <div class="form-group">
        <label for="task-description">Description</label>
        <textarea
          id="task-description"
          v-model="form.description"
          placeholder="Add a description..."
          rows="3"
        ></textarea>
      </div>
      <div class="form-group">
        <label for="task-project">Project</label>
        <select id="task-project" v-model="form.projectId">
          <option v-for="p in projects" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select>
      </div>
      <div class="form-group">
        <label id="task-date-label">Date</label>
        <JalaliDatePicker
          v-if="calendar === 'jalali'"
          :value="form.date"
          :aria-labelledby="'task-date-label'"
          @update="onPickDate"
        />
        <input
          v-else
          id="task-date"
          v-model="form.date"
          type="date"
          required
          aria-labelledby="task-date-label"
        />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" @click="emit('close')">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.85rem;
  font-weight: 500;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 0.9rem;
  background: var(--surface);
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent);
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}
</style>
