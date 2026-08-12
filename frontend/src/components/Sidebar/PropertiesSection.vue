<script setup lang="ts">
import type { Property } from '../../types'

defineProps<{
  properties: Property[]
}>()

const emit = defineEmits<{
  (e: 'add'): void
}>()
</script>

<template>
  <div class="property-list">
    <div v-for="prop in properties" :key="prop.id" class="property-item">
      <span>{{ prop.name }}</span>
      <span class="property-unit">{{ prop.unit }}</span>
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
    Add Property
  </button>
</template>

<style scoped>
.property-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
