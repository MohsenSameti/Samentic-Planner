import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsSection from './SettingsSection.vue'
import { useI18n } from '../../composables/useI18n'
import type { Calendar, Theme, WeekStartDay } from '../../types'

const props = {
  theme: 'system' as Theme,
  weekStart: 6 as WeekStartDay,
  calendar: 'jalali' as Calendar,
  language: 'fa' as const,
}

describe('SettingsSection Persian localization', () => {
  afterEach(() => {
    useI18n().setLanguage('en')
  })

  it('renders translated settings labels, weekdays, and calendar names', () => {
    const i18n = useI18n()
    i18n.setLanguage('fa')
    const wrapper = mount(SettingsSection, { props })

    expect(wrapper.findAll('.setting-label').map(label => label.text())).toEqual([
      'زبان', 'پوسته', 'شروع هفته', 'تقویم',
    ])
    expect(wrapper.find('select[aria-label="تقویم"]').findAll('option').map(option => option.text()))
      .toEqual(['میلادی', 'جلالی'])
    expect(wrapper.find('select[aria-label="شروع هفته"]').findAll('option')[0]?.text())
      .toBe('یکشنبه')

    wrapper.unmount()
  })
})
