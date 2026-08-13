import { describe, expect, test } from 'bun:test'

import {
  applyEventDrag,
  eventDatesEqual,
  formatDragOffset,
  isFullyOutsideRange,
  pixelsToDays,
  reorderLayerIds,
  resizeEventDates,
  shiftEventDates,
} from './drag'
import { createDateRange } from './layout'

const range = createDateRange(
  Date.parse('2020-01-01T00:00:00.000Z'),
  Date.parse('2020-01-11T00:00:00.000Z'),
)

describe('pointer to calendar conversion', () => {
  test('snaps a pixel delta to whole days at the current zoom', () => {
    expect(pixelsToDays(100, range, 1000)).toBe(1)
    expect(pixelsToDays(250, range, 1000)).toBe(3)
    expect(pixelsToDays(-100, range, 1000)).toBe(-1)
    expect(pixelsToDays(20, range, 1000)).toBe(0)
  })

  test('the same pixel delta means fewer days when zoomed in', () => {
    const zoomed = createDateRange(
      Date.parse('2020-01-01T00:00:00.000Z'),
      Date.parse('2020-01-06T00:00:00.000Z'),
    )

    expect(pixelsToDays(200, zoomed, 1000)).toBe(1)
    expect(pixelsToDays(200, range, 1000)).toBe(2)
  })

  test('rejects a zero width', () => {
    expect(() => pixelsToDays(10, range, 0)).toThrow()
  })
})

describe('moving an event', () => {
  test('preserves duration', () => {
    expect(
      shiftEventDates({ startDate: '2020-01-05', endDate: '2020-01-09' }, 3),
    ).toEqual({ startDate: '2020-01-08', endDate: '2020-01-12' })
  })

  test('keeps a single-day event single-day', () => {
    expect(shiftEventDates({ startDate: '2020-01-05' }, -2)).toEqual({
      startDate: '2020-01-03',
      endDate: undefined,
    })
  })

  test('crosses month and year boundaries', () => {
    expect(shiftEventDates({ startDate: '2020-12-30' }, 5)).toEqual({
      startDate: '2021-01-04',
      endDate: undefined,
    })
  })
})

describe('resizing an event', () => {
  test('moves the leading edge only', () => {
    expect(
      resizeEventDates(
        { startDate: '2020-01-05', endDate: '2020-01-10' },
        -3,
        'resize-start',
      ),
    ).toEqual({ startDate: '2020-01-02', endDate: '2020-01-10' })
  })

  test('moves the trailing edge only', () => {
    expect(
      resizeEventDates(
        { startDate: '2020-01-05', endDate: '2020-01-10' },
        4,
        'resize-end',
      ),
    ).toEqual({ startDate: '2020-01-05', endDate: '2020-01-14' })
  })

  test('never lets the edges cross', () => {
    expect(
      resizeEventDates(
        { startDate: '2020-01-05', endDate: '2020-01-10' },
        99,
        'resize-start',
      ),
    ).toEqual({ startDate: '2020-01-10', endDate: '2020-01-10' })

    expect(
      resizeEventDates(
        { startDate: '2020-01-05', endDate: '2020-01-10' },
        -99,
        'resize-end',
      ),
    ).toEqual({ startDate: '2020-01-05', endDate: '2020-01-05' })
  })

  test('growing a single-day event to the right gives it an end date', () => {
    expect(
      resizeEventDates({ startDate: '2020-01-05' }, 4, 'resize-end'),
    ).toEqual({ startDate: '2020-01-05', endDate: '2020-01-09' })
  })

  test('dispatches on drag mode', () => {
    const dates = { startDate: '2020-01-05', endDate: '2020-01-10' }

    expect(applyEventDrag(dates, 2, 'move')).toEqual({
      startDate: '2020-01-07',
      endDate: '2020-01-12',
    })
    expect(applyEventDrag(dates, 2, 'resize-end')).toEqual({
      startDate: '2020-01-05',
      endDate: '2020-01-12',
    })
    expect(applyEventDrag(dates, 0, 'move')).toBe(dates)
  })
})

describe('drag helpers', () => {
  test('compares dates treating a missing end date as absent', () => {
    expect(
      eventDatesEqual({ startDate: '2020-01-05' }, { startDate: '2020-01-05' }),
    ).toBe(true)
    expect(
      eventDatesEqual(
        { startDate: '2020-01-05' },
        { startDate: '2020-01-05', endDate: '2020-01-05' },
      ),
    ).toBe(false)
  })

  test('formats the live offset readout', () => {
    expect(formatDragOffset(0)).toBe('No change')
    expect(formatDragOffset(1)).toBe('+1 day')
    expect(formatDragOffset(12)).toBe('+12 days')
    expect(formatDragOffset(-3)).toBe('−3 days')
  })

  test('detects when a drag leaves the viewport', () => {
    expect(isFullyOutsideRange({ startDate: '2020-01-05' }, range)).toBe(false)
    expect(isFullyOutsideRange({ startDate: '2019-12-01' }, range)).toBe(true)
    expect(isFullyOutsideRange({ startDate: '2020-02-01' }, range)).toBe(true)
  })
})

describe('layer reordering', () => {
  const ids = ['a', 'b', 'c', 'd']

  test('moves a layer down to the dropped row', () => {
    expect(reorderLayerIds(ids, 'a', 'c')).toEqual(['b', 'c', 'a', 'd'])
  })

  test('moves a layer up to the dropped row', () => {
    expect(reorderLayerIds(ids, 'd', 'b')).toEqual(['a', 'd', 'b', 'c'])
  })

  test('returns null when nothing would change', () => {
    expect(reorderLayerIds(ids, 'b', 'b')).toBeNull()
    expect(reorderLayerIds(ids, 'z', 'b')).toBeNull()
  })
})
