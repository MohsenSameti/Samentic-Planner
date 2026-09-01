<script setup lang="ts">
import { ref, watch } from 'vue'
import Modal from '../components/common/Modal.vue'
import type { Project } from '../types'

const props = defineProps<{
  show: boolean
  /** When set, modal is in "edit" mode; otherwise it's "create". */
  project: Project | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: { id?: string; name: string; color: string }): void
  /** Asks the parent to delete the project being edited. */
  (e: 'delete', project: Project): void
}>()

/**
 * The fixed palette used for project colors. Kept here (not in a
 * constants file) because it's purely a presentation concern for this
 * one modal — promoting it to a global would over-couple the codebase.
 */
const COLORS = [
  '#E74C3C', '#3498DB', '#9B59B6', '#1ABC9C',
  '#F39C12', '#E91E63', '#00BCD4', '#8BC34A',
] as const

const form = ref<{ name: string; color: string }>({
  name: props.project?.name ?? '',
  color: props.project?.color ?? COLORS[0],
})

watch(
  () => props.project,
  next => {
    form.value = {
      name: next?.name ?? '',
      color: next?.color ?? COLORS[0],
    }
  },
  { immediate: true },
)

function onSubmit(): void {
  if (!form.value.name.trim()) return
  emit('save', {
    id: props.project?.id,
    name: form.value.name,
    color: form.value.color,
  })
}

function onDelete(): void {
  if (props.project) emit('delete', props.project)
}
</script>

<template>
  <Modal
    :show="show"
    :title="project ? 'Edit Project' : 'Add Project'"
    @close="emit('close')"
  >
    <form @submit.prevent="onSubmit">
      <div class="form-group">
        <label for="project-name">Name</label>
        <input
          id="project-name"
          v-model="form.name"
          type="text"
          placeholder="Project name"
          required
        />
      </div>
      <div class="form-group">
        <label>Color</label>
        <div class="color-picker">
          <div
            v-for="color in COLORS"
            :key="color"
            class="color-option"
            :class="{ selected: form.color === color }"
            :style="{ background: color }"
            role="button"
            tabindex="0"
            :aria-pressed="form.color === color"
            :aria-label="`Color ${color}`"
            @click="form.color = color"
            @keydown.enter.prevent="form.color = color"
            @keydown.space.prevent="form.color = color"
          ></div>
        </div>
      </div>
      <div class="modal-actions">
        <button
          v-if="project"
          type="button"
          class="btn btn-danger"
          @click="onDelete"
        >
          Delete
        </button>
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

.form-group input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 0.9rem;
  background: var(--surface);
  color: var(--text-primary);
  font-family: inherit;
  color-scheme: light dark;
}

.form-group input:focus {
  outline: none;
  border-color: var(--accent);
}

.color-picker {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.color-option {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  border: 3px solid transparent;
  transition: all 0.1s ease;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.color-option.selected {
  border-color: var(--text-primary);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}
</style>
