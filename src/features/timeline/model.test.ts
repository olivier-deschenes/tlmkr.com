import { describe, expect, test } from 'bun:test'

import { layerSchema, timelineEventSchema, timelineRecordSchema } from './model'

const TIMELINE_ID = '00000000-0000-4000-8000-000000000001'
const LAYER_ID = '00000000-0000-4000-8000-000000000002'
const EVENT_ID = '00000000-0000-4000-8000-000000000003'

describe('timeline schemas', () => {
  test('accepts a valid aggregate', () => {
    const result = timelineRecordSchema.safeParse({
      schemaVersion: 1,
      id: TIMELINE_ID,
      title: 'Product history',
      createdAt: '2026-08-10T12:00:00.000Z',
      updatedAt: '2026-08-10T12:00:00.000Z',
      layers: [
        {
          id: LAYER_ID,
          title: 'Releases',
          color: '#64748b',
          order: 0,
        },
      ],
      events: [
        {
          id: EVENT_ID,
          layerId: LAYER_ID,
          title: 'Version 1',
          color: '#2563eb',
          startDate: '2020-01-01',
          endDate: '2020-02-01',
        },
      ],
    })

    expect(result.success).toBe(true)
  })

  test('rejects invalid calendar dates and reversed event ranges', () => {
    expect(
      timelineEventSchema.safeParse({
        id: EVENT_ID,
        layerId: LAYER_ID,
        title: 'Impossible',
        color: '#2563eb',
        startDate: '2025-02-30',
      }).success,
    ).toBe(false)

    expect(
      timelineEventSchema.safeParse({
        id: EVENT_ID,
        layerId: LAYER_ID,
        title: 'Backwards',
        color: '#2563eb',
        startDate: '2025-02-10',
        endDate: '2025-02-09',
      }).success,
    ).toBe(false)
  })

  test('requires a six-digit hex color', () => {
    expect(
      layerSchema.safeParse({
        id: LAYER_ID,
        title: 'Layer',
        color: 'blue',
        order: 0,
      }).success,
    ).toBe(false)
  })

  test('rejects orphaned events and non-contiguous layer order', () => {
    const base = {
      schemaVersion: 1,
      id: TIMELINE_ID,
      title: 'Timeline',
      createdAt: '2026-08-10T12:00:00.000Z',
      updatedAt: '2026-08-10T12:00:00.000Z',
      layers: [
        {
          id: LAYER_ID,
          title: 'Layer',
          color: '#64748b',
          order: 1,
        },
      ],
      events: [
        {
          id: EVENT_ID,
          layerId: '00000000-0000-4000-8000-000000000099',
          title: 'Orphan',
          color: '#2563eb',
          startDate: '2020-01-01',
        },
      ],
    }

    expect(timelineRecordSchema.safeParse(base).success).toBe(false)
  })

  test('rejects inclusive date overlaps within a layer', () => {
    const result = timelineRecordSchema.safeParse({
      schemaVersion: 1,
      id: TIMELINE_ID,
      title: 'Timeline',
      createdAt: '2026-08-10T12:00:00.000Z',
      updatedAt: '2026-08-10T12:00:00.000Z',
      layers: [
        {
          id: LAYER_ID,
          title: 'Layer',
          color: '#64748b',
          order: 0,
        },
      ],
      events: [
        {
          id: EVENT_ID,
          layerId: LAYER_ID,
          title: 'First',
          color: '#2563eb',
          startDate: '2020-01-01',
          endDate: '2020-01-10',
        },
        {
          id: '00000000-0000-4000-8000-000000000004',
          layerId: LAYER_ID,
          title: 'Second',
          color: '#2563eb',
          startDate: '2020-01-10',
        },
      ],
    })

    expect(result.success).toBe(false)
  })
})
