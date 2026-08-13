import { DAY_IN_MS, addDaysToDate, parseIsoDate } from './layout'
import type { TimelineDateRange } from './layout'

/** Which part of an event a pointer gesture is moving. */
export type EventDragMode = 'move' | 'resize-start' | 'resize-end'

export interface EventDates {
  startDate: string
  endDate?: string
}

/**
 * Converts a horizontal pointer delta into whole days at the current zoom.
 * Snapping to days is what keeps a dragged event on the same grid the date
 * fields use, so a drag and a typed date can never disagree.
 */
export function pixelsToDays(
  pixels: number,
  range: TimelineDateRange,
  width: number,
): number {
  if (!Number.isFinite(width) || width <= 0) {
    throw new Error('Timeline width must be greater than zero')
  }

  const daysPerPixel = (range.endMs - range.startMs) / DAY_IN_MS / width
  return Math.round(pixels * daysPerPixel)
}

/** Slides an event by whole days, preserving its duration. */
export function shiftEventDates(dates: EventDates, days: number): EventDates {
  if (days === 0) return dates

  return {
    startDate: addDaysToDate(dates.startDate, days),
    endDate: dates.endDate ? addDaysToDate(dates.endDate, days) : undefined,
  }
}

/**
 * Moves one edge of an event.
 *
 * Dragging the trailing edge of a single-day event past its start grows it into
 * a span, which is the obvious reading of the gesture and saves a trip to the
 * dialog. Neither edge may cross the other, so the result is always a valid
 * range.
 */
export function resizeEventDates(
  dates: EventDates,
  days: number,
  mode: Exclude<EventDragMode, 'move'>,
): EventDates {
  if (days === 0) return dates

  if (mode === 'resize-start') {
    const endDate = dates.endDate ?? dates.startDate
    const startDate = addDaysToDate(dates.startDate, days)
    return {
      startDate: startDate > endDate ? endDate : startDate,
      endDate: dates.endDate,
    }
  }

  const endDate = addDaysToDate(dates.endDate ?? dates.startDate, days)
  return {
    startDate: dates.startDate,
    endDate: endDate < dates.startDate ? dates.startDate : endDate,
  }
}

export function applyEventDrag(
  dates: EventDates,
  days: number,
  mode: EventDragMode,
): EventDates {
  return mode === 'move'
    ? shiftEventDates(dates, days)
    : resizeEventDates(dates, days, mode)
}

export function eventDatesEqual(left: EventDates, right: EventDates): boolean {
  return (
    left.startDate === right.startDate &&
    (left.endDate ?? null) === (right.endDate ?? null)
  )
}

/**
 * Where a dragged layer should land, given the row the pointer is over.
 * Returns the ordered ids, or null when the drag would not move anything.
 */
export function reorderLayerIds(
  orderedLayerIds: ReadonlyArray<string>,
  draggedLayerId: string,
  targetLayerId: string,
): Array<string> | null {
  const from = orderedLayerIds.indexOf(draggedLayerId)
  const to = orderedLayerIds.indexOf(targetLayerId)
  if (from < 0 || to < 0 || from === to) return null

  const next = [...orderedLayerIds]
  next.splice(from, 1)
  next.splice(to, 0, draggedLayerId)
  return next
}

/** Formats a drag preview for the live readout, e.g. "+3 days". */
export function formatDragOffset(days: number): string {
  if (days === 0) return 'No change'
  const magnitude = Math.abs(days)
  const unit = magnitude === 1 ? 'day' : 'days'
  return `${days > 0 ? '+' : '−'}${magnitude} ${unit}`
}

/** True when the event range would leave the viewport entirely. */
export function isFullyOutsideRange(
  dates: EventDates,
  range: TimelineDateRange,
): boolean {
  const startMs = parseIsoDate(dates.startDate)
  const endMs = parseIsoDate(dates.endDate ?? dates.startDate) + DAY_IN_MS
  return endMs <= range.startMs || startMs >= range.endMs
}
