import { describe, expect, test } from 'bun:test'

import {
  calculateDateRange,
  centerViewRangeOn,
  clampViewRange,
  createDateRange,
  createTimelineLayerSegments,
  frameViewRange,
  generateTimelineTicks,
  isFittedToContent,
  layoutTimelineEventCards,
  layoutTimelineLayerSegments,
  layoutTimelineEvents,
  packTimelineEventLayouts,
  panViewRange,
  resolveMinimumLabelWidth,
  todayIsoDate,
  zoomViewRange,
  DAY_IN_MS,
  MINIMUM_VIEW_DAYS,
} from './layout'
import type { TimelineEvent } from './model'

const LAYER_ID = '00000000-0000-4000-8000-000000000001'

function event(id: string, startDate: string, endDate?: string): TimelineEvent {
  return {
    id,
    layerId: LAYER_ID,
    title: id,
    color: '#2563eb',
    startDate,
    endDate,
  }
}

describe('timeline date range', () => {
  test('returns no derived range for an empty timeline', () => {
    expect(calculateDateRange([])).toBeNull()
  })

  test('pads a single date by 15 days on each side', () => {
    expect(
      calculateDateRange([
        event('00000000-0000-4000-8000-000000000011', '2020-01-16'),
      ]),
    ).toEqual({
      startDate: '2020-01-01',
      endDate: '2020-01-31',
      startMs: Date.parse('2020-01-01T00:00:00.000Z'),
      endMs: Date.parse('2020-01-31T00:00:00.000Z'),
      totalDays: 30,
    })
  })

  test('uses whole-day three-percent padding for a multi-year range', () => {
    const range = calculateDateRange([
      event('00000000-0000-4000-8000-000000000011', '2000-01-01', '2010-01-01'),
    ])!

    expect(range.startDate).toBe('1999-09-13')
    expect(range.endDate).toBe('2010-04-21')
    expect(range.totalDays).toBe(3873)
  })
})

describe('adaptive timeline ticks', () => {
  test('uses day, month, and nice year ticks as density changes', () => {
    const shortRange = calculateDateRange([
      event('00000000-0000-4000-8000-000000000011', '2020-01-01'),
      event('00000000-0000-4000-8000-000000000012', '2020-01-10'),
    ])!
    const mediumRange = calculateDateRange([
      event('00000000-0000-4000-8000-000000000011', '2020-01-01'),
      event('00000000-0000-4000-8000-000000000012', '2022-01-01'),
    ])!
    const longRange = calculateDateRange([
      event('00000000-0000-4000-8000-000000000011', '1900-01-01'),
      event('00000000-0000-4000-8000-000000000012', '2020-01-01'),
    ])!

    expect(generateTimelineTicks(shortRange, 800)[0].unit).toBe('day')
    expect(generateTimelineTicks(mediumRange, 800)[0].unit).toBe('month')
    const yearTicks = generateTimelineTicks(longRange, 800)
    expect(yearTicks[0].unit).toBe('year')
    expect(
      yearTicks.slice(1).every((tick, index) => {
        const previousYear = Number(yearTicks[index].label)
        return Number(tick.label) - previousYear === 20
      }),
    ).toBe(true)
  })
})

describe('event layout and collision packing', () => {
  test('keeps duration geometry proportional while guaranteeing a hit target', () => {
    const point = event('00000000-0000-4000-8000-000000000011', '2020-01-05')
    const duration = event(
      '00000000-0000-4000-8000-000000000012',
      '2020-01-02',
      '2020-01-08',
    )
    const range = calculateDateRange([point, duration])!
    const layouts = layoutTimelineEvents([point, duration], range, 900)

    expect(layouts[0]).toMatchObject({ kind: 'point', width: 32, barWidth: 2 })
    expect(layouts[1].kind).toBe('duration')
    expect(layouts[1].barWidth).toBeCloseTo(layouts[1].endX - layouts[1].startX)
    expect(layouts[1].width).toBeGreaterThanOrEqual(32)
  })

  test('widens labels without changing the exact event geometry', () => {
    const duration = event(
      '00000000-0000-4000-8000-000000000012',
      '2020-01-05',
      '2020-01-06',
    )
    const range = calculateDateRange([
      duration,
      event('00000000-0000-4000-8000-000000000013', '2021-01-05'),
    ])!
    const [layout] = layoutTimelineEvents([duration], range, 900, {
      minimumLabelWidth: 160,
    })

    expect(layout.width).toBe(160)
    expect(layout.barWidth).toBeCloseTo(layout.endX - layout.startX)
    expect(layout.barWidth).toBeLessThan(layout.width)
    expect(layout.barLeft).toBe(layout.startX)
  })

  test('puts simultaneous events into separate rows', () => {
    const events = [
      event('00000000-0000-4000-8000-000000000011', '2020-01-05'),
      event('00000000-0000-4000-8000-000000000012', '2020-01-05'),
      event('00000000-0000-4000-8000-000000000013', '2020-01-05'),
    ]
    const range = calculateDateRange(events)!
    const packed = packTimelineEventLayouts(
      layoutTimelineEvents(events, range, 800),
    )

    expect(packed.rowCount).toBe(3)
    expect(packed.events.map((layout) => layout.row)).toEqual([0, 1, 2])
  })

  test('reuses a row when hit areas do not overlap', () => {
    const events = [
      event('00000000-0000-4000-8000-000000000011', '2020-01-01'),
      event('00000000-0000-4000-8000-000000000012', '2020-06-01'),
    ]
    const range = calculateDateRange(events)!
    const packed = packTimelineEventLayouts(
      layoutTimelineEvents(events, range, 800),
    )

    expect(packed.rowCount).toBe(1)
    expect(packed.events.map((layout) => layout.row)).toEqual([0, 0])
  })
})

describe('single-line layer segments', () => {
  test('orders events and inserts duration-aware gaps between them', () => {
    const events = [
      event('00000000-0000-4000-8000-000000000012', '2020-01-08', '2020-01-10'),
      event('00000000-0000-4000-8000-000000000011', '2020-01-01', '2020-01-03'),
      event('00000000-0000-4000-8000-000000000013', '2020-01-11'),
    ]

    expect(createTimelineLayerSegments(events)).toEqual([
      {
        kind: 'event',
        eventId: '00000000-0000-4000-8000-000000000011',
        startDate: '2020-01-01',
        endDate: '2020-01-03',
        durationDays: 3,
      },
      {
        kind: 'gap',
        startDate: '2020-01-04',
        endDate: '2020-01-07',
        durationDays: 4,
      },
      {
        kind: 'event',
        eventId: '00000000-0000-4000-8000-000000000012',
        startDate: '2020-01-08',
        endDate: '2020-01-10',
        durationDays: 3,
      },
      {
        kind: 'event',
        eventId: '00000000-0000-4000-8000-000000000013',
        startDate: '2020-01-11',
        endDate: '2020-01-11',
        durationDays: 1,
      },
    ])
  })

  test('keeps event and gap widths proportional on one line', () => {
    const events = [
      event('00000000-0000-4000-8000-000000000011', '2020-01-01', '2020-01-03'),
      event('00000000-0000-4000-8000-000000000012', '2020-01-08', '2020-01-10'),
    ]
    const range = calculateDateRange(events)!
    const layouts = layoutTimelineLayerSegments(events, range, 900)

    expect(layouts).toHaveLength(3)
    expect(layouts[0].width).toBeCloseTo(layouts[2].width)
    expect(layouts[1].width / layouts[0].width).toBeCloseTo(4 / 3)
    expect(layouts[1].left).toBeCloseTo(layouts[0].left + layouts[0].width)
    expect(layouts[2].left).toBeCloseTo(layouts[1].left + layouts[1].width)
  })

  test('alternates colliding information cards above and below the line', () => {
    const events = [
      event('00000000-0000-4000-8000-000000000011', '2020-01-01'),
      event('00000000-0000-4000-8000-000000000012', '2020-01-02'),
      event('00000000-0000-4000-8000-000000000013', '2020-01-03'),
      event('00000000-0000-4000-8000-000000000014', '2020-12-31'),
    ]
    const range = calculateDateRange(events)!
    const layout = layoutTimelineEventCards(events, range, 800)

    expect(
      layout.cards.slice(0, 3).map(({ side, level }) => ({ side, level })),
    ).toEqual([
      { side: 'above', level: 0 },
      { side: 'below', level: 0 },
      { side: 'above', level: 1 },
    ])
    expect(layout.aboveRowCount).toBe(2)
    expect(layout.belowRowCount).toBe(1)
  })
})

describe('viewport zoom and pan', () => {
  const content = calculateDateRange([
    event('00000000-0000-4000-8000-000000000011', '2020-01-01'),
    event('00000000-0000-4000-8000-000000000012', '2020-12-31'),
  ])!

  test('zooming in keeps the anchored date under the same position', () => {
    const zoomed = zoomViewRange(content, content, 0.5, 0.25)
    const anchorMs = content.startMs + (content.endMs - content.startMs) * 0.25

    expect(zoomed.endMs - zoomed.startMs).toBeCloseTo(
      (content.endMs - content.startMs) / 2,
      -3,
    )
    expect(
      (anchorMs - zoomed.startMs) / (zoomed.endMs - zoomed.startMs),
    ).toBeCloseTo(0.25, 5)
  })

  test('never zooms out past the content or in past the minimum span', () => {
    expect(isFittedToContent(zoomViewRange(content, content, 8), content)).toBe(
      true,
    )

    const tightest = zoomViewRange(content, content, 0.0001)
    expect(tightest.endMs - tightest.startMs).toBe(
      MINIMUM_VIEW_DAYS * DAY_IN_MS,
    )
  })

  test('panning stops at the content edges instead of drifting', () => {
    const zoomed = zoomViewRange(content, content, 0.25)

    expect(panViewRange(zoomed, content, -10).startMs).toBe(content.startMs)
    expect(panViewRange(zoomed, content, 10).endMs).toBe(content.endMs)
  })

  test('panning preserves the zoom level', () => {
    const zoomed = zoomViewRange(content, content, 0.25)
    const panned = panViewRange(zoomed, content, 0.2)

    expect(panned.endMs - panned.startMs).toBeCloseTo(
      zoomed.endMs - zoomed.startMs,
      5,
    )
  })

  test('clamps a viewport that is wider than its content', () => {
    const tooWide = createDateRange(
      content.startMs - 5 * DAY_IN_MS,
      content.endMs + 5 * DAY_IN_MS,
    )

    expect(clampViewRange(tooWide, content)).toEqual(content)
  })

  test('centers on a date without changing the zoom level', () => {
    const zoomed = zoomViewRange(content, content, 0.25)
    const centered = centerViewRangeOn(zoomed, content, '2020-07-01')
    const center = (centered.startMs + centered.endMs) / 2

    expect(centered.endMs - centered.startMs).toBeCloseTo(
      zoomed.endMs - zoomed.startMs,
      5,
    )
    expect(center).toBeCloseTo(Date.parse('2020-07-01T00:00:00.000Z'), -6)
  })

  test('frames a span with padding on both sides', () => {
    const framed = frameViewRange('2020-06-01', '2020-06-30', content)

    expect(framed.startMs).toBeLessThan(Date.parse('2020-06-01T00:00:00.000Z'))
    expect(framed.endMs).toBeGreaterThan(Date.parse('2020-06-30T00:00:00.000Z'))
    expect(isFittedToContent(framed, content)).toBe(false)
  })
})

describe('viewport culling', () => {
  const events = [
    event('00000000-0000-4000-8000-000000000011', '2020-01-01', '2020-01-10'),
    event('00000000-0000-4000-8000-000000000012', '2020-06-01', '2020-06-10'),
    event('00000000-0000-4000-8000-000000000013', '2020-12-01', '2020-12-10'),
  ]

  test('drops events outside the viewport instead of stacking them on an edge', () => {
    const view = createDateRange(
      Date.parse('2020-05-01T00:00:00.000Z'),
      Date.parse('2020-07-01T00:00:00.000Z'),
    )
    const layouts = layoutTimelineLayerSegments(events, view, 900)
    const visibleIds = layouts.flatMap((layout) =>
      layout.segment.kind === 'event' ? [layout.segment.eventId] : [],
    )

    expect(visibleIds).toEqual(['00000000-0000-4000-8000-000000000012'])
  })

  test('keeps an event that straddles the viewport edge', () => {
    const view = createDateRange(
      Date.parse('2020-06-05T00:00:00.000Z'),
      Date.parse('2020-08-01T00:00:00.000Z'),
    )
    const [first] = layoutTimelineLayerSegments(events, view, 900)

    expect(first.segment).toMatchObject({
      kind: 'event',
      eventId: '00000000-0000-4000-8000-000000000012',
    })
    expect(first.left).toBe(0)
    expect(first.width).toBeGreaterThan(0)
  })

  test('culls cards along with their segments', () => {
    const view = createDateRange(
      Date.parse('2020-05-01T00:00:00.000Z'),
      Date.parse('2020-07-01T00:00:00.000Z'),
    )

    expect(layoutTimelineEventCards(events, view, 900).cards).toHaveLength(1)
  })
})

describe('responsive label width', () => {
  test('shrinks with the lane but stays legible', () => {
    expect(resolveMinimumLabelWidth(1200)).toBe(160)
    expect(resolveMinimumLabelWidth(400)).toBe(120)
    expect(resolveMinimumLabelWidth(200)).toBe(84)
  })

  test('a narrow lane stacks into fewer rows than the old fixed floor', () => {
    const narrowEvents = [
      event('00000000-0000-4000-8000-000000000011', '2020-01-01'),
      event('00000000-0000-4000-8000-000000000012', '2020-04-01'),
      event('00000000-0000-4000-8000-000000000013', '2020-07-01'),
      event('00000000-0000-4000-8000-000000000014', '2020-10-01'),
    ]
    const range = calculateDateRange(narrowEvents)!
    const rowCount = (options?: { minimumLabelWidth: number }) => {
      const layout = layoutTimelineEventCards(narrowEvents, range, 340, options)
      return layout.aboveRowCount + layout.belowRowCount
    }

    expect(rowCount()).toBeLessThan(rowCount({ minimumLabelWidth: 160 }))
  })
})

describe('today', () => {
  test('reads the UTC calendar date', () => {
    expect(todayIsoDate(new Date('2024-03-05T23:30:00.000Z'))).toBe(
      '2024-03-05',
    )
  })
})
