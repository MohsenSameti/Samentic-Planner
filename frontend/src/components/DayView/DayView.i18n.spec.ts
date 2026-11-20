import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import DayView from './DayView.vue'
import { useI18n } from '../../composables/useI18n'

enableAutoUnmount(afterEach)

afterEach(() => {
  useI18n().setLanguage('en')
})

describe('DayView Persian localization', () => {
  it('translates every task-count label in the summary line', () => {
    useI18n().setLanguage('fa')
    const wrapper = mount(DayView, {
      props: {
        date: '2024-01-15',
        dayNum: 15,
        tasks: [],
        projects: new Map(),
        properties: [],
        propertyValues: [],
        dayNoteValue: '',
        selectedProject: 'all',
        calendar: 'gregorian',
        summary: {
          active: 2,
          completed: 1,
          skipped: 3,
          cancelled: 4,
          propertyValues: [],
        },
      },
    })

    const summary = wrapper.get('.day-view-summary')
    expect(summary.text()).toContain('در حال انجام')
    expect(summary.text()).toContain('انجام‌شده')
    expect(summary.text()).toContain('به‌تعویق‌افتاده')
    expect(summary.text()).toContain('لغوشده')
  })

  it('declares RTL flip transform for back and navigation chevrons', () => {
    const sfcSource = readFileSync(
      resolve(process.cwd(), 'src/components/DayView/DayView.vue'),
      'utf8',
    )
    expect(sfcSource).toMatch(
      /:root\[dir="rtl"\]\s+\.day-back-btn\s+svg,\s*:root\[dir="rtl"\]\s+\.day-prev-btn\s+svg,\s*:root\[dir="rtl"\]\s+\.day-next-btn\s+svg\s*\{\s*transform:\s*scaleX\(-1\);/m,
    )
  })
})
