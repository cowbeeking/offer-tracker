import { describe, expect, it } from 'vitest'
import { isValidLocalDateTime, toDateInput, toLocalDateTimeInput } from '@/utils/date'

describe('date utilities', () => {
  it('formats local dates without UTC shifts', () => {
    const date = new Date(2026, 7, 20, 9, 5)
    expect(toDateInput(date)).toBe('2026-08-20')
    expect(toLocalDateTimeInput(date)).toBe('2026-08-20T09:05')
  })

  it('validates calendar dates and minute precision', () => {
    expect(isValidLocalDateTime('2024-02-29T23:59')).toBe(true)
    expect(isValidLocalDateTime('2026-02-29T12:00')).toBe(false)
    expect(isValidLocalDateTime('2026-08-20T24:00')).toBe(false)
    expect(isValidLocalDateTime('2026-08-20T09:05:00')).toBe(false)
  })
})
