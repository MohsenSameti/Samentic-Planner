<script setup lang="ts">
defineProps<{
  /** Pre-formatted week display string (e.g. "Mar 4 - 10, 2024"). */
  weekDisplay: string
  /** Whether the sidebar is currently collapsed (controls the hamburger/X icon). */
  sidebarCollapsed: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-sidebar'): void
  (e: 'prev-week'): void
  (e: 'next-week'): void
  (e: 'go-today'): void
}>()
</script>

<template>
  <header class="header">
    <div class="header-left">
      <button
        class="sidebar-toggle"
        type="button"
        aria-label="Toggle menu"
        @click="emit('toggle-sidebar')"
      >
        <svg
          v-if="sidebarCollapsed"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <div class="logo">
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="3" y="6" width="26" height="23" rx="3" stroke="currentColor" stroke-width="2" fill="none" />
          <line x1="3" y1="12" x2="29" y2="12" stroke="currentColor" stroke-width="2" />
          <line x1="9" y1="3" x2="9" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <line x1="23" y1="3" x2="23" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <h1>Planner</h1>
      </div>
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
        <button class="today-btn" type="button" @click="emit('go-today')">Today</button>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 16px 24px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo svg {
  width: 32px;
  height: 32px;
}

.logo h1 {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  font-weight: normal;
}

.week-nav {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  background: var(--surface);
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

.today-btn {
  padding: 8px 16px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  font-family: inherit;
}

.today-btn:hover {
  background: #b84700;
}

.today-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.sidebar-toggle {
  display: flex;
  width: 40px;
  height: 40px;
  background: transparent;
  color: var(--text);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.sidebar-toggle:hover {
  background: var(--bg);
}

.sidebar-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.sidebar-toggle svg {
  width: 22px;
  height: 22px;
}

@media (max-width: 768px) {
  .header {
    padding: 12px 16px;
    overflow: visible;
  }

  .header-left {
    gap: 12px;
    flex-shrink: 0;
  }

  .logo h1 {
    font-size: 1.2rem;
  }

  .logo svg {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
  }

  .week-nav {
    flex-shrink: 0;
  }

  .week-display {
    font-size: 0.8rem;
    min-width: 130px;
  }

  .today-btn {
    padding: 6px 12px;
    font-size: 0.8rem;
    white-space: nowrap;
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
