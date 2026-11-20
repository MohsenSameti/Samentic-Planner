<script setup lang="ts">
import type { Property } from '../../types'
import { useI18n } from '../../composables/useI18n'

defineProps<{
  properties: Property[]
}>()

const { t } = useI18n()

const emit = defineEmits<{
  (e: 'add'): void
  (e: 'edit', property: Property): void
}>()
</script>

<template>
  <div v-if="properties.length > 0" class="property-list">
    <div v-for="prop in properties" :key="prop.id" class="property-item">
      <span class="property-name">{{ prop.name }}</span>
      <span class="property-unit">{{ prop.unit }}</span>
      <button
        type="button"
        class="property-edit-btn"
        :aria-label="`${t('Edit')} ${prop.name}`"
        :title="t('Edit property')"
        @click.stop="emit('edit', prop)"
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
  <p v-else class="property-empty">{{ t('No trackers yet.') }}</p>
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
    {{ t('Add Property') }}
  </button>
</template>

<style scoped>
.property-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.property-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-size: 0.9rem;
  border-radius: 6px;
  transition: background 0.1s ease;
}

.property-item:hover {
  background: var(--bg);
}

.property-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.property-unit {
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-family: var(--font-mono);
}

.property-edit-btn {
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

.property-item:hover .property-edit-btn,
.property-edit-btn:focus-visible {
  opacity: 1;
}

.property-edit-btn:hover {
  opacity: 1;
  color: var(--text-primary);
  background: var(--surface);
}

.property-edit-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.property-edit-btn svg {
  width: 14px;
  height: 14px;
}

@media (max-width: 1024px) {
  .property-edit-btn {
    width: 32px;
    height: 32px;
    min-width: 32px;
    min-height: 32px;
    opacity: 0.9;
  }

  .property-edit-btn svg {
    width: 16px;
    height: 16px;
  }

  .property-empty {
    font-size: 0.9rem;
  }
}

.property-empty {
  color: var(--text-secondary);
  font-size: 0.85rem;
  padding: var(--space-2) var(--space-3);
  margin: 0;
  line-height: 1.4;
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
</style>
