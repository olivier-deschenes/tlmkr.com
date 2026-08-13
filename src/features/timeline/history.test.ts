import { describe, expect, test } from 'bun:test'

import {
  EMPTY_TIMELINE_HISTORY,
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  describeRedo,
  describeUndo,
  recordHistoryEntry,
  redoHistory,
  undoHistory,
} from './history'
import { addEvent, addLayer, createTimeline } from './operations'
import type { TimelineRecord } from './model'

const TIMELINE_ID = '00000000-0000-4000-8000-000000000010'

function baseTimeline(): TimelineRecord {
  return createTimeline('History', {
    timelineId: TIMELINE_ID,
    defaultLayerId: '00000000-0000-4000-8000-000000000001',
    now: '2024-01-01T00:00:00.000Z',
  })
}

function withLayer(timeline: TimelineRecord, title: string): TimelineRecord {
  return addLayer(
    timeline,
    { title, color: '#2563eb' },
    {
      id: `00000000-0000-4000-8000-00000000002${title.length}`,
      now: '2024-01-02T00:00:00.000Z',
    },
  )
}

describe('history stack', () => {
  test('starts empty', () => {
    expect(canUndo(EMPTY_TIMELINE_HISTORY)).toBe(false)
    expect(canRedo(EMPTY_TIMELINE_HISTORY)).toBe(false)
    expect(undoHistory(EMPTY_TIMELINE_HISTORY)).toBeNull()
    expect(redoHistory(EMPTY_TIMELINE_HISTORY)).toBeNull()
  })

  test('undo returns the state from before the edit', () => {
    const before = baseTimeline()
    const after = withLayer(before, 'Second')
    const history = recordHistoryEntry(EMPTY_TIMELINE_HISTORY, {
      label: 'Add layer',
      timelineId: TIMELINE_ID,
      before,
      after,
    })

    const step = undoHistory(history)!
    expect(step.state).toEqual(before)
    expect(canUndo(step.history)).toBe(false)
    expect(canRedo(step.history)).toBe(true)
  })

  test('redo replays the state from after the edit', () => {
    const before = baseTimeline()
    const after = withLayer(before, 'Second')
    const history = recordHistoryEntry(EMPTY_TIMELINE_HISTORY, {
      label: 'Add layer',
      timelineId: TIMELINE_ID,
      before,
      after,
    })

    const undone = undoHistory(history)!
    const redone = redoHistory(undone.history)!

    expect(redone.state).toEqual(after)
    expect(canUndo(redone.history)).toBe(true)
    expect(canRedo(redone.history)).toBe(false)
  })

  test('walks back through several edits in order', () => {
    const first = baseTimeline()
    const second = withLayer(first, 'Second')
    const third = addEvent(
      second,
      {
        title: 'Kickoff',
        layerId: second.layers[0].id,
        color: '#2563eb',
        startDate: '2024-02-01',
      },
      { id: '00000000-0000-4000-8000-000000000031' },
    )

    let history = recordHistoryEntry(EMPTY_TIMELINE_HISTORY, {
      label: 'Add layer',
      timelineId: TIMELINE_ID,
      before: first,
      after: second,
    })
    history = recordHistoryEntry(history, {
      label: 'Add event',
      timelineId: TIMELINE_ID,
      before: second,
      after: third,
    })

    expect(describeUndo(history)).toBe('Add event')

    const undoEvent = undoHistory(history)!
    expect(undoEvent.state).toEqual(second)
    expect(describeUndo(undoEvent.history)).toBe('Add layer')
    expect(describeRedo(undoEvent.history)).toBe('Add event')

    const undoLayer = undoHistory(undoEvent.history)!
    expect(undoLayer.state).toEqual(first)
    expect(canUndo(undoLayer.history)).toBe(false)
  })

  test('a new edit discards the redo branch', () => {
    const first = baseTimeline()
    const second = withLayer(first, 'Second')
    const history = recordHistoryEntry(EMPTY_TIMELINE_HISTORY, {
      label: 'Add layer',
      timelineId: TIMELINE_ID,
      before: first,
      after: second,
    })
    const undone = undoHistory(history)!

    expect(canRedo(undone.history)).toBe(true)

    const branched = recordHistoryEntry(undone.history, {
      label: 'Rename timeline',
      timelineId: TIMELINE_ID,
      before: first,
      after: { ...first, title: 'Renamed' },
    })

    expect(canRedo(branched)).toBe(false)
  })

  test('models timeline creation and deletion with the same entry shape', () => {
    const timeline = baseTimeline()

    const created = recordHistoryEntry(EMPTY_TIMELINE_HISTORY, {
      label: 'Create timeline',
      timelineId: TIMELINE_ID,
      after: timeline,
    })
    expect(undoHistory(created)!.state).toBeUndefined()

    const deleted = recordHistoryEntry(EMPTY_TIMELINE_HISTORY, {
      label: 'Delete timeline',
      timelineId: TIMELINE_ID,
      before: timeline,
    })
    expect(undoHistory(deleted)!.state).toEqual(timeline)
  })

  test('drops the oldest entries past the limit', () => {
    const timeline = baseTimeline()
    let history = EMPTY_TIMELINE_HISTORY

    for (let index = 0; index < HISTORY_LIMIT + 10; index++) {
      history = recordHistoryEntry(history, {
        label: `Edit ${index}`,
        timelineId: TIMELINE_ID,
        before: timeline,
        after: timeline,
      })
    }

    expect(history.past).toHaveLength(HISTORY_LIMIT)
    expect(history.past[0].label).toBe('Edit 10')
    expect(describeUndo(history)).toBe(`Edit ${HISTORY_LIMIT + 9}`)
  })
})
