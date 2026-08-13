import type { TimelineRecord } from './model'

/** How many steps back the editor can walk before the oldest one is dropped. */
export const HISTORY_LIMIT = 50

/**
 * One reversible edit, stored as the whole timeline on either side of it.
 *
 * Every operation in `operations.ts` is already a pure
 * `TimelineRecord -> TimelineRecord` function, so snapshots are both cheap to
 * capture and exact to replay — there is no command to invert. An absent
 * `before` means the timeline did not exist yet; an absent `after` means the
 * edit removed it. That covers layer and event edits, timeline creation, and
 * timeline deletion with one shape.
 */
export interface TimelineHistoryEntry {
  label: string
  timelineId: string
  before?: TimelineRecord
  after?: TimelineRecord
}

export interface TimelineHistory {
  past: ReadonlyArray<TimelineHistoryEntry>
  future: ReadonlyArray<TimelineHistoryEntry>
}

export interface TimelineHistoryStep {
  history: TimelineHistory
  entry: TimelineHistoryEntry
  /** The timeline state to write back, or undefined to delete the timeline. */
  state?: TimelineRecord
}

export const EMPTY_TIMELINE_HISTORY: TimelineHistory = { past: [], future: [] }

/** Adds an edit to the stack, discarding any redo branch it invalidates. */
export function recordHistoryEntry(
  history: TimelineHistory,
  entry: TimelineHistoryEntry,
): TimelineHistory {
  return {
    past: [...history.past, entry].slice(-HISTORY_LIMIT),
    future: [],
  }
}

export function canUndo(history: TimelineHistory): boolean {
  return history.past.length > 0
}

export function canRedo(history: TimelineHistory): boolean {
  return history.future.length > 0
}

/** The label of the edit that undo would reverse, for menus and tooltips. */
export function describeUndo(history: TimelineHistory): string | undefined {
  return history.past.at(-1)?.label
}

/** The label of the edit that redo would replay. */
export function describeRedo(history: TimelineHistory): string | undefined {
  return history.future.at(-1)?.label
}

export function undoHistory(
  history: TimelineHistory,
): TimelineHistoryStep | null {
  const entry = history.past.at(-1)
  if (!entry) return null

  return {
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, entry],
    },
    entry,
    state: entry.before,
  }
}

export function redoHistory(
  history: TimelineHistory,
): TimelineHistoryStep | null {
  const entry = history.future.at(-1)
  if (!entry) return null

  return {
    history: {
      past: [...history.past, entry].slice(-HISTORY_LIMIT),
      future: history.future.slice(0, -1),
    },
    entry,
    state: entry.after,
  }
}
