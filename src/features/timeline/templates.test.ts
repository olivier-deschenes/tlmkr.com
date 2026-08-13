import { describe, expect, test } from 'bun:test'

import { createTimelineFromTemplate, timelineTemplates } from './templates'
import { timelineRecordSchema } from './model'
import { calculateDateRange } from './layout'

const NOW = new Date('2024-06-01T00:00:00.000Z')

describe('starter templates', () => {
  test.each(timelineTemplates.map((template) => [template.id, template]))(
    'the %s template builds a valid timeline',
    (_id, template) => {
      const timeline = createTimelineFromTemplate(template, NOW)

      expect(() => timelineRecordSchema.parse(timeline)).not.toThrow()
      expect(timeline.title).toBe(template.title)
      expect(timeline.layers).toHaveLength(template.layers.length)
      expect(timeline.events).toHaveLength(template.events.length)
    },
  )

  test('lands the timeline around today rather than a fixed year', () => {
    const [roadmap] = timelineTemplates
    const range = calculateDateRange(
      createTimelineFromTemplate(roadmap, NOW).events,
    )!

    expect(range.startMs).toBeLessThan(NOW.getTime())
    expect(range.endMs).toBeGreaterThan(NOW.getTime())
  })

  test('keeps the first layer subtitle from the template', () => {
    const [roadmap] = timelineTemplates
    const timeline = createTimelineFromTemplate(roadmap, NOW)
    const firstLayer = timeline.layers.find((layer) => layer.order === 0)!

    expect(firstLayer.title).toBe(roadmap.layers[0].title)
    expect(firstLayer.subtitle).toBe(roadmap.layers[0].subtitle)
  })

  test('assigns every event to the layer the template names', () => {
    for (const template of timelineTemplates) {
      const timeline = createTimelineFromTemplate(template, NOW)
      const orderedLayers = [...timeline.layers].sort(
        (left, right) => left.order - right.order,
      )

      template.events.forEach((templateEvent, index) => {
        expect(timeline.events[index].layerId).toBe(
          orderedLayers[templateEvent.layer].id,
        )
      })
    }
  })

  test('produces distinct ids on every use', () => {
    const [roadmap] = timelineTemplates
    const first = createTimelineFromTemplate(roadmap, NOW)
    const second = createTimelineFromTemplate(roadmap, NOW)

    expect(first.id).not.toBe(second.id)
    expect(first.layers[0].id).not.toBe(second.layers[0].id)
  })
})
