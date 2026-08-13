<script setup lang="ts">
import { ref, watch } from 'vue'
import Modal from '../components/common/Modal.vue'
import JalaliDatePicker from '../components/common/JalaliDatePicker.vue'
import type { Calendar, Task } from '../types'

const props = defineProps<{
  show: boolean
  task: Task | null
  /**
   * Which calendar to render in the date field. The prop is only
   * consumed in the template (the `v-if` swap between the native
   * `<input type="date">` and `<JalaliDatePicker>`); the script's
   * `onPickDate` is calendar-agnostic because both controls emit
   * the same Gregorian ISO shape.
   */
  calendar: Calendar
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'move', task: Task, date: string): void
}>()

/** Local mirror of the destination date. Initialised from the task. */
const moveDate = ref<string>(props.task?.date ?? '')

watch(
  () => props.task,
  next => {
    moveDate.value = next?.date ?? ''
  },
  { immediate: true },
)

function onSubmit(): void {
  if (!props.task) return
  emit('move', props.task, moveDate.value)
}

/**
 * Handler for the Jalali picker's `update` event. The picker emits
 * a Gregorian ISO string, which we store directly in `moveDate` —
 * the same shape `<input type="date">` produces.
 */
function onPickDate(value: string): void {
  moveDate.value = value
}
</script>

<template>
  <Modal :show="show" title="Move Task" @close="emit('close')">
    <form @submit.prevent="onSubmit">
      <div class="form-group">
        <label id="move-date-label">Move to</label>
        <JalaliDatePicker
          v-if="calendar === 'jalali'"
          :value="moveDate"
          aria-labelledby="move-date-label"
          @update="onPickDate"
        />
        <input
          v-else
          id="move-date"
          v-model="moveDate"
          type="date"
          required
          aria-labelledby="move-date-label"
        />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" @click="emit('close')">Cancel</button>
        <button type="submit" class="btn btn-primary">Move</button>
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
  font-family: inherit;
}

.form-group input:focus {
  outline: none;
  border-color: var(--accent);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}
</style>
