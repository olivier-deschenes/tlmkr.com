import { describe, expect, test } from 'bun:test'

import {
  addEvent,
  addLayer,
  createTimeline,
  deleteLayer,
  duplicateEvent,
  moveLayer,
  reorderLayers,
  selectTimelineAfterDeletion,
  updateEvent,
} from './operations'

const NOW = '2026-08-10T12:00:00.000Z'
const LATER = '2026-08-10T13:00:00.000Z'
const TIMELINE_ID = '00000000-0000-4000-8000-000000000001'
const LAYER_A_ID = '00000000-0000-4000-8000-000000000002'
const LAYER_B_ID = '00000000-0000-4000-8000-000000000003'
const LAYER_C_ID = '00000000-0000-4000-8000-000000000004'
const EVENT_ID = '00000000-0000-4000-8000-000000000005'
const COPY_ID = '00000000-0000-4000-8000-000000000006'

function timelineWithTwoLayers() {
  const timeline = createTimeline('History', {
    timelineId: TIMELINE_ID,
    defaultLayerId: LAYER_A_ID,
    defaultLayerTitle: 'Products',
    now: NOW,
  })
  return addLayer(
    timeline,
    { title: 'Companies', color: '#0f766e' },
    { id: LAYER_B_ID, now: NOW },
  )
}

describe('timeline operations', () => {
  test('creates a timeline with one editable default layer', () => {
    const timeline = createTimeline('History', {
      timelineId: TIMELINE_ID,
      defaultLayerId: LAYER_A_ID,
      now: NOW,
    })

    expect(timeline.layers).toHaveLength(1)
    expect(timeline.layers[0]).toMatchObject({
      id: LAYER_A_ID,
      title: 'Layer 1',
      order: 0,
    })
    expect(timeline.createdAt).toBe(NOW)
    expect(timeline.updatedAt).toBe(NOW)
  })

  test('reorders and moves layers without mutating the source', () => {
    const twoLayers = timelineWithTwoLayers()
    const source = addLayer(
      twoLayers,
      { title: 'People', color: '#7c3aed' },
      { id: LAYER_C_ID, now: NOW },
    )
    const reordered = reorderLayers(
      source,
      [LAYER_C_ID, LAYER_A_ID, LAYER_B_ID],
      { now: LATER },
    )
    const moved = moveLayer(reordered, LAYER_A_ID, 'down', { now: LATER })

    expect(source.layers.map((layer) => layer.id)).toEqual([
      LAYER_A_ID,
      LAYER_B_ID,
      LAYER_C_ID,
    ])
    expect(reordered.layers.map((layer) => [layer.id, layer.order])).toEqual([
      [LAYER_C_ID, 0],
      [LAYER_A_ID, 1],
      [LAYER_B_ID, 2],
    ])
    expect(moved.layers.map((layer) => layer.id)).toEqual([
      LAYER_C_ID,
      LAYER_B_ID,
      LAYER_A_ID,
    ])
  })

  test('duplicates an event with a new ID and a copy suffix', () => {
    const timeline = addEvent(
      timelineWithTwoLayers(),
      {
        layerId: LAYER_A_ID,
        title: 'Launch',
        subtitle: 'Public beta',
        description: 'First public release',
        color: '#dc2626',
        startDate: '2010-04-01',
        endDate: '2010-05-01',
      },
      { id: EVENT_ID, now: NOW },
    )
    const duplicated = duplicateEvent(timeline, EVENT_ID, {
      id: COPY_ID,
      now: LATER,
    })

    expect(timeline.events).toHaveLength(1)
    expect(duplicated.events).toHaveLength(2)
    expect(duplicated.events[1]).toEqual({
      ...timeline.events[0],
      id: COPY_ID,
      title: 'Launch copy',
    })
    expect(duplicated.updatedAt).toBe(LATER)
  })

  test('moves an event to another layer and cascades layer deletion', () => {
    const withEvent = addEvent(
      timelineWithTwoLayers(),
      {
        layerId: LAYER_A_ID,
        title: 'Launch',
        color: '#dc2626',
        startDate: '2010-04-01',
      },
      { id: EVENT_ID, now: NOW },
    )
    const moved = updateEvent(
      withEvent,
      EVENT_ID,
      { layerId: LAYER_B_ID },
      { now: LATER },
    )
    const deleted = deleteLayer(moved, LAYER_B_ID, { now: LATER })

    expect(moved.events[0].layerId).toBe(LAYER_B_ID)
    expect(deleted.layers.map((layer) => [layer.id, layer.order])).toEqual([
      [LAYER_A_ID, 0],
    ])
    expect(deleted.events).toEqual([])
  })

  test('selects the adjacent timeline after deleting the selected one', () => {
    const timelines = [
      createTimeline('One', {
        timelineId: '00000000-0000-4000-8000-000000000011',
        defaultLayerId: '00000000-0000-4000-8000-000000000021',
        now: NOW,
      }),
      createTimeline('Two', {
        timelineId: '00000000-0000-4000-8000-000000000012',
        defaultLayerId: '00000000-0000-4000-8000-000000000022',
        now: NOW,
      }),
      createTimeline('Three', {
        timelineId: '00000000-0000-4000-8000-000000000013',
        defaultLayerId: '00000000-0000-4000-8000-000000000023',
        now: NOW,
      }),
    ]

    expect(
      selectTimelineAfterDeletion(timelines, timelines[1].id, timelines[1].id),
    ).toBe(timelines[2].id)
    expect(
      selectTimelineAfterDeletion(timelines, timelines[2].id, timelines[2].id),
    ).toBe(timelines[1].id)
  })
})
