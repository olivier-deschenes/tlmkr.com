import { describe, expect, test } from 'bun:test'

import type { TimelineRecord } from './model'
import { createTimelineExport } from './timelineExport'

const timeline: TimelineRecord = {
  schemaVersion: 1,
  id: '00000000-0000-4000-8000-000000000001',
  title: 'Roadmap: Caf\u00e9 & Launch',
  createdAt: '2026-08-10T12:00:00.000Z',
  updatedAt: '2026-08-10T12:00:00.000Z',
  layers: [
    {
      id: '00000000-0000-4000-8000-000000000002',
      title: 'Product, web',
      subtitle: 'Core work',
      description: 'Planning\nand delivery',
      color: '#2563eb',
      order: 0,
    },
    {
      id: '00000000-0000-4000-8000-000000000003',
      title: 'Marketing',
      color: '#0f766e',
      order: 1,
    },
  ],
  events: [
    {
      id: '00000000-0000-4000-8000-000000000004',
      layerId: '00000000-0000-4000-8000-000000000002',
      title: 'Launch "beta"',
      startDate: '2026-09-01',
      endDate: '2026-09-10',
      color: '#7c3aed',
    },
  ],
}

describe('timeline export', () => {
  test('creates a lossless, readable JSON download', () => {
    const exported = createTimelineExport(timeline, 'json')

    expect(exported.filename).toBe('roadmap-cafe-launch.json')
    expect(exported.mimeType).toBe('application/json;charset=utf-8')
    expect(JSON.parse(exported.contents)).toEqual(timeline)
  })

  test('creates CSV rows for events and empty layers', () => {
    const exported = createTimelineExport(timeline, 'csv')

    expect(exported.filename).toBe('roadmap-cafe-launch.csv')
    expect(exported.contents).toContain('"Product, web"')
    expect(exported.contents).toContain('"Launch ""beta"""')
    expect(exported.contents).toContain('"Planning\nand delivery"')
    expect(exported.contents).toContain('Marketing,,,,,,,,#0f766e')
  })
})
