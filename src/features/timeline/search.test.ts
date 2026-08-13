import { describe, expect, test } from 'bun:test'

import { searchTimeline } from './search'
import { addEvent, addLayer, createTimeline } from './operations'
import type { TimelineRecord } from './model'

function sampleTimeline(): TimelineRecord {
  let timeline = createTimeline('Search', {
    timelineId: '00000000-0000-4000-8000-000000000010',
    defaultLayerId: '00000000-0000-4000-8000-000000000001',
    defaultLayerTitle: 'Platform',
    now: '2024-01-01T00:00:00.000Z',
  })
  timeline = addLayer(
    timeline,
    { title: 'Marketing', color: '#db2777' },
    { id: '00000000-0000-4000-8000-000000000002' },
  )

  const events: Array<[string, string, string, string | undefined]> = [
    ['000000000101', 'Auth rewrite', '2024-01-05', 'OAuth and passkeys'],
    ['000000000102', 'Billing v2', '2024-03-05', undefined],
    ['000000000103', 'Launch campaign', '2024-05-05', undefined],
  ]

  events.forEach(([id, title, startDate, subtitle], index) => {
    timeline = addEvent(
      timeline,
      {
        title,
        subtitle,
        layerId: timeline.layers[index === 2 ? 1 : 0].id,
        color: '#2563eb',
        startDate,
        description: index === 1 ? 'Usage-based pricing' : undefined,
      },
      { id: `00000000-0000-4000-8000-${id}` },
    )
  })

  return timeline
}

describe('event search', () => {
  const timeline = sampleTimeline()

  test('an empty query matches everything and stays inactive', () => {
    const result = searchTimeline(timeline, '   ')

    expect(result.isActive).toBe(false)
    expect(result.matchCount).toBe(3)
    expect(result.matchedEventIds.size).toBe(3)
  })

  test('matches titles case-insensitively', () => {
    const result = searchTimeline(timeline, 'AUTH')

    expect(result.isActive).toBe(true)
    expect(result.matchCount).toBe(1)
    expect([...result.matchedEventIds]).toEqual([
      '00000000-0000-4000-8000-000000000101',
    ])
  })

  test('matches subtitles and descriptions', () => {
    expect(searchTimeline(timeline, 'passkeys').matchCount).toBe(1)
    expect(searchTimeline(timeline, 'usage-based').matchCount).toBe(1)
  })

  test('matches the layer an event sits on', () => {
    const result = searchTimeline(timeline, 'marketing')

    expect([...result.matchedEventIds]).toEqual([
      '00000000-0000-4000-8000-000000000103',
    ])
  })

  test('matches dates so a year narrows the view', () => {
    expect(searchTimeline(timeline, '2024-03').matchCount).toBe(1)
    expect(searchTimeline(timeline, '2024').matchCount).toBe(3)
  })

  test('reports no matches without throwing', () => {
    const result = searchTimeline(timeline, 'nothing here')

    expect(result.isActive).toBe(true)
    expect(result.matchCount).toBe(0)
  })
})
