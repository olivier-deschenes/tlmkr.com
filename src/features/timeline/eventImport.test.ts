import { describe, expect, test } from 'bun:test'

import { createTimeline } from './operations'
import {
  createChatGptEventPrompt,
  createChatGptEventUrl,
  EventImportError,
  importEventsFromJson,
  parseEventImport,
} from './eventImport'

const NOW = '2026-08-10T12:00:00.000Z'
const TIMELINE_ID = '00000000-0000-4000-8000-000000000001'
const LAYER_ID = '00000000-0000-4000-8000-000000000002'
const EVENT_A_ID = '00000000-0000-4000-8000-000000000003'
const EVENT_B_ID = '00000000-0000-4000-8000-000000000004'

function timeline() {
  return createTimeline('Product history', {
    timelineId: TIMELINE_ID,
    defaultLayerId: LAYER_ID,
    defaultLayerTitle: 'Launches',
    now: NOW,
  })
}

describe('event JSON import', () => {
  test('adds validated events to an existing layer', () => {
    const ids = [EVENT_A_ID, EVENT_B_ID]
    const imported = importEventsFromJson(
      timeline(),
      JSON.stringify({
        events: [
          {
            title: 'Private beta',
            layer: 'Launches',
            startDate: '2026-09-01',
          },
          {
            title: 'General availability',
            layer: 'launches',
            startDate: '2026-10-15',
            endDate: '2026-10-16',
            color: '#0f766e',
          },
        ],
      }),
      { idFactory: () => ids.shift()!, now: NOW },
    )

    expect(imported.events).toHaveLength(2)
    expect(imported.events[0]).toMatchObject({
      id: EVENT_A_ID,
      layerId: LAYER_ID,
      title: 'Private beta',
      color: '#2563eb',
    })
    expect(imported.events[1]).toMatchObject({
      id: EVENT_B_ID,
      title: 'General availability',
      color: '#0f766e',
    })
  })

  test('rejects invalid dates and unknown fields before importing', () => {
    expect(() =>
      parseEventImport(
        JSON.stringify({
          events: [
            {
              title: 'Launch',
              layer: 'Launches',
              startDate: '2026-02-30',
              unexpected: true,
            },
          ],
        }),
      ),
    ).toThrow(EventImportError)
  })

  test('rejects events whose layer does not exist', () => {
    expect(() =>
      importEventsFromJson(
        timeline(),
        JSON.stringify({
          events: [
            {
              title: 'Launch',
              layer: 'People',
              startDate: '2026-09-01',
            },
          ],
        }),
      ),
    ).toThrow('No layer named \"People\" exists')
  })

  test('rejects overlapping imported events', () => {
    expect(() =>
      importEventsFromJson(
        timeline(),
        JSON.stringify({
          events: [
            {
              title: 'Launch window',
              layer: 'Launches',
              startDate: '2026-09-01',
              endDate: '2026-09-10',
            },
            {
              title: 'Launch day',
              layer: 'Launches',
              startDate: '2026-09-10',
            },
          ],
        }),
        { idFactory: () => crypto.randomUUID(), now: NOW },
      ),
    ).toThrow(EventImportError)
  })

  test('builds a ChatGPT prompt with the accepted format and current layers', () => {
    const prompt = createChatGptEventPrompt(timeline())
    const url = new URL(createChatGptEventUrl(timeline()))

    expect(prompt).toContain('valid JSON only')
    expect(prompt).toContain('- Launches')
    expect(prompt).toContain('YYYY-MM-DD')
    expect(url.origin).toBe('https://chatgpt.com')
    expect(url.searchParams.get('q')).toBe(prompt)
  })
})
