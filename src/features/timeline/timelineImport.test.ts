import { describe, expect, test } from 'bun:test'

import type { TimelineRecord } from './model'
import {
  importTimelineFromJson,
  parseTimelineImport,
  TimelineImportError,
} from './timelineImport'

const TIMELINE_ID = '00000000-0000-4000-8000-000000000001'
const NEW_TIMELINE_ID = '00000000-0000-4000-8000-000000000099'

const validTimeline: TimelineRecord = {
  schemaVersion: 1,
  id: TIMELINE_ID,
  title: 'Imported history',
  createdAt: '2026-08-10T12:00:00.000Z',
  updatedAt: '2026-08-10T12:00:00.000Z',
  layers: [
    {
      id: '00000000-0000-4000-8000-000000000002',
      title: 'Releases',
      color: '#64748b',
      order: 0,
    },
  ],
  events: [
    {
      id: '00000000-0000-4000-8000-000000000003',
      layerId: '00000000-0000-4000-8000-000000000002',
      title: 'Version 1',
      color: '#2563eb',
      startDate: '2020-01-01',
    },
  ],
}

describe('full timeline JSON import', () => {
  test('imports a complete timeline without losing data', () => {
    expect(parseTimelineImport(JSON.stringify(validTimeline))).toEqual(
      validTimeline,
    )
  })

  test('assigns a new timeline id when the exported id already exists', () => {
    const imported = importTimelineFromJson(JSON.stringify(validTimeline), {
      existingIds: [TIMELINE_ID],
      idFactory: () => NEW_TIMELINE_ID,
    })

    expect(imported).toEqual({ ...validTimeline, id: NEW_TIMELINE_ID })
  })

  test('rejects malformed JSON and invalid timeline relationships', () => {
    expect(() => parseTimelineImport('{')).toThrow(TimelineImportError)
    expect(() =>
      parseTimelineImport(
        JSON.stringify({
          ...validTimeline,
          events: [{ ...validTimeline.events[0], layerId: TIMELINE_ID }],
        }),
      ),
    ).toThrow('Event must reference an existing layer')
  })
})
