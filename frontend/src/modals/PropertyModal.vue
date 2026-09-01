<script setup lang="ts">
import { ref, watch } from 'vue'
import Modal from '../components/common/Modal.vue'
import type { Property } from '../types'

const props = defineProps<{
  show: boolean
  property: Property | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: { id?: string; name: string; unit: string }): void
  (e: 'delete', property: Property): void
}>()

const form = ref<{ name: string; unit: string }>({
  name: props.property?.name ?? '',
  unit: props.property?.unit ?? '',
})

watch(
  () => props.property,
  next => {
    form.value = {
      name: next?.name ?? '',
      unit: next?.unit ?? '',
    }
  },
  { immediate: true },
)

function onSubmit(): void {
  if (!form.value.name.trim()) return
  emit('save', {
    id: props.property?.id,
    name: form.value.name,
    unit: form.value.unit,
  })
}

function onDelete(): void {
  if (props.property) emit('delete', props.property)
}
</script>

<template>
  <Modal
    :show="show"
    :title="property ? 'Edit Property' : 'Add Property'"
    @close="emit('close')"
  >
    <form @submit.prevent="onSubmit">
      <div class="form-group">
        <label for="property-name">Name</label>
        <input
          id="property-name"
          v-model="form.name"
          type="text"
          placeholder="e.g., Hours, Pages"
          required
        />
      </div>
      <div class="form-group">
        <label for="property-unit">Unit</label>
        <input
          id="property-unit"
          v-model="form.unit"
          type="text"
          placeholder="e.g., hrs, km"
        />
      </div>
      <div class="modal-actions">
        <button
          v-if="property"
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

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}
</style>
