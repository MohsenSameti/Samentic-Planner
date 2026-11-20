import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useI18n } from './useI18n'

describe('useI18n', () => {
  beforeEach(() => {
    // localStorage is cleared globally by setup.ts; also reset the
    // module-level language singleton so tests are fully isolated.
    useI18n().setLanguage('en')
    document.documentElement.removeAttribute('lang')
    document.documentElement.removeAttribute('dir')
  })

  afterEach(() => {
    useI18n().setLanguage('en')
    document.documentElement.removeAttribute('lang')
    document.documentElement.removeAttribute('dir')
  })

  it('defaults to English and applies LTR document language before rendering', () => {
    const i18n = useI18n()
    i18n.initLanguage()

    expect(i18n.language.value).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    expect(document.documentElement.dir).toBe('ltr')
  })

  it('loads and persists a validated language choice and applies RTL', () => {
    localStorage.setItem('planner.language', 'fa')
    const i18n = useI18n()
    i18n.initLanguage()

    expect(i18n.language.value).toBe('fa')
    expect(document.documentElement.lang).toBe('fa')
    expect(document.documentElement.dir).toBe('rtl')
    expect(i18n.t('language')).toBe('زبان')

    i18n.setLanguage('en')
    expect(localStorage.getItem('planner.language')).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    expect(document.documentElement.dir).toBe('ltr')
  })

  it('translates common authentication errors and keeps validation digits Western', () => {
    const i18n = useI18n()
    i18n.setLanguage('fa')

    expect(i18n.translateText('Invalid password')).toBe('گذرواژه نادرست است')
    expect(i18n.translateText('Current password is incorrect')).toBe('گذرواژهٔ فعلی نادرست است')
    expect(i18n.t('Password must be at least 8 characters.')).not.toMatch(/[۰-۹]/)
    expect(i18n.t('New password must be at least 8 characters.')).not.toMatch(/[۰-۹]/)
    expect(i18n.t('General')).toBe('عمومی')
    expect(i18n.formatDeleteProject('کارها', 2)).toBe('پروژهٔ «کارها» حذف شود؟ 2 کار بدون پروژه می‌ماند.')
    expect(i18n.formatDeleteProject('کارها', 0)).toBe('پروژهٔ «کارها» حذف شود؟')
    expect(i18n.formatDeleteProperty('ساعت')).toBe('ویژگی «ساعت» حذف شود؟ همهٔ مقادیر آن پاک می‌شوند.')
    i18n.setLanguage('en')
    expect(i18n.t('General')).toBe('General')
    expect(i18n.formatDeleteProject('Tasks', 2)).toBe('Delete "Tasks"? 2 tasks will be moved to no project.')
    expect(i18n.formatDeleteProject('Tasks', 0)).toBe('Delete "Tasks"?')
    expect(i18n.formatDeleteProperty('Hours')).toBe('Delete "Hours"? All values will be removed.')
  })

  it('ignores malformed stored language values', () => {
    localStorage.setItem('planner.language', 'ar')
    const i18n = useI18n()
    i18n.initLanguage()

    expect(i18n.language.value).toBe('en')
  })
})
