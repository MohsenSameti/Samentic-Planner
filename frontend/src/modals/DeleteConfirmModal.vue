<script setup lang="ts">
import Modal from '../components/common/Modal.vue'

defineProps<{
  show: boolean
  /** Message describing what will be deleted. */
  message: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()
</script>

<template>
  <Modal :show="show" title="Confirm Delete" @close="emit('close')">
    <p class="message">{{ message }}</p>
    <div class="modal-actions">
      <button type="button" class="btn btn-secondary" @click="emit('close')">Cancel</button>
      <button type="button" class="btn btn-danger" @click="emit('confirm')">Delete</button>
    </div>
  </Modal>
</template>

<style scoped>
.message {
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
