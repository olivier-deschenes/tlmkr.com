import { describe, expect, test } from 'bun:test'

import {
  calculatePreciseDuration,
  formatEventDuration,
  formatLayerDuration,
  formatPreciseDuration,
} from '#/features/timeline/duration'

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

describe('precise layer duration formatting', () => {
  test('uses the earliest start and latest end across the layer', () => {
    expect(
      formatLayerDuration([
        { startDate: '2022-03-10', endDate: '2023-04-15' },
        { startDate: '2020-01-15', endDate: '2020-02-01' },
        { startDate: '2021-06-01' },
      ]),
    ).toBe('3 years, 3 months, 1 day')
  })

  test('counts both boundary dates', () => {
    expect(formatLayerDuration([{ startDate: '2026-08-10' }])).toBe('1 day')
    expect(
      formatLayerDuration([{ startDate: '2025-01-01', endDate: '2026-01-01' }]),
    ).toBe('1 year, 1 day')
  })

  test('handles calendar month lengths and leap years precisely', () => {
    expect(calculatePreciseDuration('2024-02-29', '2025-02-28')).toEqual({
      years: 1,
      months: 0,
      days: 1,
    })
    expect(calculatePreciseDuration('2026-01-31', '2026-03-01')).toEqual({
      years: 0,
      months: 1,
      days: 2,
    })
  })

  test('omits zero units and returns no duration for an empty layer', () => {
    expect(formatPreciseDuration({ years: 2, months: 0, days: 3 })).toBe(
      '2 years, 3 days',
    )
    expect(formatLayerDuration([])).toBeNull()
  })
})
