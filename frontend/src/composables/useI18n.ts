import { ref, type Ref } from 'vue'
import type { Language } from '../types'
import {
  formatDeleteProjectConfirm,
  formatDeletePropertyConfirm,
  translate,
  translateText,
  type MessageKey,
} from '../i18n/messages'

const LANGUAGE_STORAGE_KEY = 'planner.language'
const language: Ref<Language> = ref<Language>('en')

function applyLanguage(value: Language): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = value
  document.documentElement.dir = value === 'fa' ? 'rtl' : 'ltr'
}

function loadLanguage(): Language {
  try {
    const value = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (value === 'en' || value === 'fa') return value
  } catch {
    // Storage may be unavailable; English is the safe default.
  }
  return 'en'
}

function initLanguage(): void {
  language.value = loadLanguage()
  applyLanguage(language.value)
}

function setLanguage(next: Language): boolean {
  if (next !== 'en' && next !== 'fa') return false
  language.value = next
  applyLanguage(next)
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
  } catch {
    // Keep the in-memory choice when persistence is unavailable.
  }
  return true
}

export function useI18n(): {
  language: Ref<Language>
  initLanguage: () => void
  setLanguage: (next: Language) => boolean
  t: (key: MessageKey) => string
  translateText: (source: string) => string
  formatDeleteProject: (projectName: string, taskCount: number) => string
  formatDeleteProperty: (propertyName: string) => string
} {
  return {
    language,
    initLanguage,
    setLanguage,
    t: (key: MessageKey): string => translate(language.value, key),
    translateText: (source: string): string => translateText(language.value, source),
    formatDeleteProject: (projectName: string, taskCount: number): string =>
      formatDeleteProjectConfirm(language.value, projectName, taskCount),
    formatDeleteProperty: (propertyName: string): string =>
      formatDeletePropertyConfirm(language.value, propertyName),
  }
}
