<script setup lang="ts">
defineProps<{
  /** Pre-formatted week display string (e.g. "Mar 4 - 10, 2024"). */
  weekDisplay: string
}>()

const emit = defineEmits<{
  (e: 'prev-week'): void
  (e: 'next-week'): void
}>()
</script>

<template>
  <nav class="week-nav" aria-label="Week navigation">
    <button class="nav-btn" type="button" aria-label="Previous week" @click="emit('prev-week')">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
    <span class="week-display">{{ weekDisplay }}</span>
    <button class="nav-btn" type="button" aria-label="Next week" @click="emit('next-week')">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  </nav>
</template>

<style scoped>
.week-nav {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.nav-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  background: var(--surface);
  /* Explicit `color` so the chevron SVG (which uses
   * `stroke="currentColor"`) resolves to the theme-aware
   * `--text-primary` rather than the browser UA `buttontext`
   * color — some browsers still render that one black even when
   * the page is dark, which is the same regression that hit the
   * `Header` icon buttons. */
  color: var(--text-primary);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s ease;
  font-family: inherit;
}

.nav-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.nav-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.nav-btn svg {
  width: 18px;
  height: 18px;
}

.week-display {
  font-family: var(--font-mono);
  font-size: 0.95rem;
  min-width: 180px;
  text-align: center;
}

@media (max-width: 768px) {
  .week-nav {
    flex-shrink: 0;
  }

  .week-display {
    font-size: 0.8rem;
    min-width: 130px;
  }

  .nav-btn {
    width: 32px;
    height: 32px;
  }

  .nav-btn svg {
    width: 16px;
    height: 16px;
  }
}
</style>
