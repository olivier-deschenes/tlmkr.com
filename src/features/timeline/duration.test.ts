import { describe, expect, test } from 'bun:test'

import { formatEventDuration } from '#/features/timeline/duration'

describe('event duration formatting', () => {
  test('uses days for short events', () => {
    expect(formatEventDuration('2026-08-10')).toBe('1 day')
    expect(formatEventDuration('2026-08-10', '2026-08-19')).toBe('10 days')
  })

  test('uses weeks, months, and years as the span grows', () => {
    expect(formatEventDuration('2026-08-01', '2026-08-21')).toBe('3 weeks')
    expect(formatEventDuration('2026-01-01', '2026-10-27')).toBe('10 months')
    expect(formatEventDuration('2024-01-01', '2026-09-26')).toBe('2.7 years')
  })
})
