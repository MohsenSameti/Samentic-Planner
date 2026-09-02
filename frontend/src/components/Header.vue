<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

defineProps<{
  /** Whether the sidebar is currently collapsed (controls the hamburger/X icon). */
  sidebarCollapsed: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-sidebar'): void
  (e: 'go-today'): void
  (e: 'logout'): void
  /** Fired when the user picks "Change password" from the settings menu. */
  (e: 'change-password'): void
}>()

/** Whether the gear-icon settings dropdown is currently open. */
const menuOpen = ref<boolean>(false)

/** Template refs for the outside-click detection. */
const menuRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)

/**
 * Close-on-outside-click handler. `mousedown` (not `click`) is used
 * deliberately — same reasoning as the modal: a click on the gear
 * trigger fires `mousedown` first, then `click`, and `show` flips
 * between them. Listening for `click` would cause the opening click
 * to bubble to `document` and close the menu it just opened. Touch
 * devices fire synthetic `mousedown` before `click`, so this stays
 * correct on mobile.
 */
function handleDocumentMouseDown(e: MouseEvent): void {
  if (!menuOpen.value) return
  const target = e.target as Node
  if (menuRef.value && menuRef.value.contains(target)) return
  if (triggerRef.value && triggerRef.value.contains(target)) return
  menuOpen.value = false
}

/**
 * Escape closes the menu when it's open. The `menuOpen` gate avoids
 * stealing Escape from other modals (which have their own handlers).
 */
function handleKeydown(e: KeyboardEvent): void {
  if (menuOpen.value && e.key === 'Escape') {
    menuOpen.value = false
  }
}

function toggleMenu(): void {
  menuOpen.value = !menuOpen.value
}

/**
 * Close the menu first, then emit `change-password` so the parent can
 * open the modal. Using `nextTick` ensures the menu's `v-if` removal
 * has settled before the modal opens — without it, the menu and modal
 * can briefly overlap and the outside-click handler can fire.
 */
async function handleChangePasswordClick(): Promise<void> {
  menuOpen.value = false
  await nextTick()
  emit('change-password')
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('mousedown', handleDocumentMouseDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('mousedown', handleDocumentMouseDown)
})
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
    </div>
    <div class="header-right">
      <button class="today-btn" type="button" @click="emit('go-today')">Today</button>

      <!-- Settings menu: gear button + dropdown. -->
      <div class="settings-wrapper">
        <button
          ref="triggerRef"
          class="settings-btn"
          type="button"
          aria-label="Settings"
          title="Settings"
          aria-haspopup="menu"
          :aria-expanded="menuOpen"
          @click="toggleMenu"
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
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        <ul
          v-if="menuOpen"
          ref="menuRef"
          class="settings-menu"
          role="menu"
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              class="settings-menu-item"
              @click="handleChangePasswordClick"
            >
              Change password
            </button>
          </li>
        </ul>
      </div>

      <button
        class="logout-btn"
        type="button"
        aria-label="Log out"
        title="Log out"
        @click="emit('logout')"
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
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: var(--space-4) var(--space-6);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
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

.today-btn {
  padding: var(--space-2) var(--space-4);
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  font-family: inherit;
}

.today-btn:hover {
  background: var(--accent-hover);
}

.today-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.logout-btn {
  display: flex;
  width: 36px;
  height: 36px;
  background: transparent;
  color: var(--text-primary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logout-btn:hover {
  background: var(--bg);
  color: var(--accent);
}

.logout-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.logout-btn svg {
  width: 20px;
  height: 20px;
}

/* Settings (gear) button + dropdown ------------------------------------- */

.settings-wrapper {
  position: relative;
  display: flex;
}

.settings-btn {
  display: flex;
  width: 36px;
  height: 36px;
  background: transparent;
  color: var(--text-primary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.settings-btn:hover {
  background: var(--bg);
  color: var(--accent);
}

.settings-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.settings-btn svg {
  width: 20px;
  height: 20px;
}

.settings-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 180px;
  margin: 0;
  padding: var(--space-2) 0;
  list-style: none;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: var(--shadow-md);
  z-index: 200;
}

.settings-menu-item {
  width: 100%;
  text-align: left;
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 0.875rem;
  cursor: pointer;
}

.settings-menu-item:hover {
  background: var(--bg);
}

.settings-menu-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/* Existing sidebar-toggle styles kept below for parity. */

.sidebar-toggle {
  display: flex;
  width: 40px;
  height: 40px;
  background: transparent;
  color: var(--text-primary);
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
    padding: var(--space-3) var(--space-4);
    overflow: visible;
  }

  .header-left {
    gap: var(--space-3);
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

  .today-btn {
    padding: var(--space-2) var(--space-3);
    font-size: 0.8rem;
    white-space: nowrap;
  }

  /* Keep the dropdown anchored to the right edge so it never
     overflows the viewport on narrow screens. */
  .settings-menu {
    right: 0;
  }
}
</style>
