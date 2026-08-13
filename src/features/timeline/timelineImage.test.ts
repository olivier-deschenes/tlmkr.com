import { describe, expect, test } from 'bun:test'

import { createTimelineSvg, measureTimelineSvg } from './timelineImage'
import { createDateRange } from './layout'
import { addEvent, addLayer, createTimeline } from './operations'
import type { TimelineRecord } from './model'

function sampleTimeline(): TimelineRecord {
  let timeline = createTimeline('Quarterly plan', {
    timelineId: '00000000-0000-4000-8000-000000000010',
    defaultLayerId: '00000000-0000-4000-8000-000000000001',
    defaultLayerTitle: 'Platform',
    now: '2024-01-01T00:00:00.000Z',
  })
  timeline = addLayer(
    timeline,
    { title: 'Marketing', subtitle: 'Launch work', color: '#db2777' },
    { id: '00000000-0000-4000-8000-000000000002' },
  )
  timeline = addEvent(
    timeline,
    {
      title: 'Auth rewrite',
      layerId: '00000000-0000-4000-8000-000000000001',
      color: '#2563eb',
      startDate: '2024-01-05',
      endDate: '2024-02-20',
    },
    { id: '00000000-0000-4000-8000-000000000101' },
  )
  timeline = addEvent(
    timeline,
    {
      title: 'Campaign',
      layerId: '00000000-0000-4000-8000-000000000002',
      color: '#db2777',
      startDate: '2024-03-01',
      endDate: '2024-04-15',
    },
    { id: '00000000-0000-4000-8000-000000000102' },
  )

  return timeline
}

describe('svg export', () => {
  const timeline = sampleTimeline()

  test('renders a self-contained svg document', () => {
    const svg = createTimelineSvg(timeline)

    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    // No external references: the image must open anywhere.
    expect(svg).not.toContain('<image')
    expect(svg).not.toContain('http://localhost')
  })

  test('includes every title and layer name', () => {
    const svg = createTimelineSvg(timeline)

    expect(svg).toContain('Quarterly plan')
    expect(svg).toContain('Platform')
    expect(svg).toContain('Marketing')
    expect(svg).toContain('Auth rewrite')
    expect(svg).toContain('Campaign')
  })

  test('paints each event in its own color', () => {
    const svg = createTimelineSvg(timeline)

    expect(svg).toContain('#2563eb')
    expect(svg).toContain('#db2777')
  })

  test('escapes markup in user text', () => {
    const hostile: TimelineRecord = {
      ...timeline,
      title: '</svg><script>alert(1)</script> & "quotes"',
    }
    const svg = createTimelineSvg(hostile)

    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
    expect(svg).toContain('&amp;')
    expect(svg.match(/<\/svg>/g)).toHaveLength(1)
  })

  test('grows taller as lanes stack more rows', () => {
    const short = measureTimelineSvg(createTimelineSvg(timeline))
    let crowded = timeline
    for (let index = 0; index < 12; index++) {
      crowded = addEvent(
        crowded,
        {
          title: `Filler ${index}`,
          layerId: '00000000-0000-4000-8000-000000000001',
          color: '#2563eb',
          startDate: new Date(Date.UTC(2024, 5, 1 + index * 2))
            .toISOString()
            .slice(0, 10),
        },
        {
          id: `00000000-0000-4000-8000-${String(index + 200).padStart(12, '0')}`,
        },
      )
    }

    expect(
      measureTimelineSvg(createTimelineSvg(crowded)).height,
    ).toBeGreaterThan(short.height)
  })

  test('honours the requested width', () => {
    expect(
      measureTimelineSvg(createTimelineSvg(timeline, { width: 900 })).width,
    ).toBe(900)
  })

  test('renders only what the viewport shows', () => {
    const zoomed = createTimelineSvg(timeline, {
      range: createDateRange(
        Date.parse('2024-01-01T00:00:00.000Z'),
        Date.parse('2024-02-25T00:00:00.000Z'),
      ),
    })

    expect(zoomed).toContain('Auth rewrite')
    expect(zoomed).not.toContain('Campaign')
  })

  test('switches palette for the dark theme', () => {
    const light = createTimelineSvg(timeline, { theme: 'light' })
    const dark = createTimelineSvg(timeline, { theme: 'dark' })

    expect(light).toContain('#ffffff')
    expect(dark).toContain('#0f1115')
  })

  test('renders a timeline with no events without failing', () => {
    const empty = createTimeline('Nothing yet', {
      timelineId: '00000000-0000-4000-8000-000000000020',
      now: '2024-01-01T00:00:00.000Z',
    })

    expect(() => createTimelineSvg(empty)).not.toThrow()
    expect(measureTimelineSvg(createTimelineSvg(empty)).height).toBeGreaterThan(
      0,
    )
  })
})
