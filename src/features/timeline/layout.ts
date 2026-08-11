import type { TimelineEvent } from './model'

export const DAY_IN_MS = 86_400_000

export interface TimelineDateRange {
  startDate: string
  endDate: string
  startMs: number
  endMs: number
  totalDays: number
}

export type TimelineTickUnit = 'day' | 'month' | 'year'

export interface TimelineTick {
  date: string
  label: string
  position: number
  unit: TimelineTickUnit
}

export type TimelineEventKind = 'point' | 'duration'

export interface TimelineEventLayout {
  eventId: string
  layerId: string
  kind: TimelineEventKind
  startX: number
  endX: number
  barLeft: number
  barWidth: number
  left: number
  width: number
}

export interface PackedTimelineEventLayout extends TimelineEventLayout {
  row: number
}

export interface PackedTimelineLayout {
  events: PackedTimelineEventLayout[]
  rowCount: number
}

export interface TimelineLayerEventSegment {
  kind: 'event'
  eventId: string
  startDate: string
  endDate: string
  durationDays: number
}

export interface TimelineLayerGapSegment {
  kind: 'gap'
  startDate: string
  endDate: string
  durationDays: number
}

export type TimelineLayerSegment =
  TimelineLayerEventSegment | TimelineLayerGapSegment

export interface TimelineLayerSegmentLayout {
  segment: TimelineLayerSegment
  left: number
  width: number
}

export type TimelineEventCardSide = 'above' | 'below'

export interface TimelineEventCardLayout {
  eventId: string
  left: number
  width: number
  anchorX: number
  side: TimelineEventCardSide
  level: number
}

export interface TimelineEventCardLayoutResult {
  cards: TimelineEventCardLayout[]
  aboveRowCount: number
  belowRowCount: number
}

export interface TimelineLayoutOptions {
  minimumHitWidth?: number
  minimumLabelWidth?: number
}

function parseDate(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`)
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

function addDays(date: string, days: number): string {
  return formatDate(parseDate(date) + days * DAY_IN_MS)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function assertWidth(width: number): void {
  if (!Number.isFinite(width) || width <= 0) {
    throw new Error('Timeline width must be greater than zero')
  }
}

export function calculateDateRange(
  events: ReadonlyArray<Pick<TimelineEvent, 'startDate' | 'endDate'>>,
): TimelineDateRange | null {
  if (events.length === 0) return null

  const earliestMs = Math.min(
    ...events.map((event) => parseDate(event.startDate)),
  )
  const latestMs = Math.max(
    ...events.map((event) => parseDate(event.endDate ?? event.startDate)),
  )
  const eventSpanDays = (latestMs - earliestMs) / DAY_IN_MS
  const paddingDays =
    eventSpanDays === 0 ? 15 : Math.max(1, Math.ceil(eventSpanDays * 0.03))
  const startMs = earliestMs - paddingDays * DAY_IN_MS
  const endMs = latestMs + paddingDays * DAY_IN_MS

  return {
    startDate: formatDate(startMs),
    endDate: formatDate(endMs),
    startMs,
    endMs,
    totalDays: (endMs - startMs) / DAY_IN_MS,
  }
}

export const deriveTimelineDateRange = calculateDateRange

export function dateToPosition(
  date: string,
  range: TimelineDateRange,
  width: number,
): number {
  assertWidth(width)
  const ratio =
    (parseDate(date) - range.startMs) / (range.endMs - range.startMs)
  return clamp(ratio * width, 0, width)
}

function niceCeiling(value: number, candidates: ReadonlyArray<number>): number {
  for (const candidate of candidates) {
    if (candidate >= value) return candidate
  }
  return candidates.at(-1)!
}

function niceYearStep(roughYears: number): number {
  if (roughYears <= 1) return 1
  const exponent = 10 ** Math.floor(Math.log10(roughYears))
  const normalized = roughYears / exponent
  return niceCeiling(normalized, [1, 2, 5, 10]) * exponent
}

function resolveTickUnitAndStep(
  range: TimelineDateRange,
  width: number,
  minimumSpacing: number,
): { unit: TimelineTickUnit; step: number } {
  const desiredIntervals = Math.max(2, Math.floor(width / minimumSpacing))
  const roughDays = range.totalDays / desiredIntervals

  if (roughDays <= 32) {
    return {
      unit: 'day',
      step: niceCeiling(roughDays, [1, 2, 5, 7, 10, 14, 21, 30]),
    }
  }

  if (roughDays <= 180) {
    return {
      unit: 'month',
      step: niceCeiling(roughDays / 30.4375, [1, 2, 3, 6]),
    }
  }

  return { unit: 'year', step: niceYearStep(roughDays / 365.25) }
}

function firstAlignedTimestamp(
  range: TimelineDateRange,
  unit: TimelineTickUnit,
  step: number,
): number {
  const start = new Date(range.startMs)

  if (unit === 'day') {
    const dayNumber = Math.ceil(range.startMs / DAY_IN_MS)
    return Math.ceil(dayNumber / step) * step * DAY_IN_MS
  }

  if (unit === 'month') {
    const startMonth = start.getUTCFullYear() * 12 + start.getUTCMonth()
    const alignedMonth = Math.ceil(startMonth / step) * step
    return Date.UTC(Math.floor(alignedMonth / 12), alignedMonth % 12, 1)
  }

  const year = Math.ceil(start.getUTCFullYear() / step) * step
  return Date.UTC(year, 0, 1)
}

function advanceTimestamp(
  timestamp: number,
  unit: TimelineTickUnit,
  step: number,
): number {
  if (unit === 'day') return timestamp + step * DAY_IN_MS

  const date = new Date(timestamp)
  if (unit === 'month') {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + step, 1)
  }
  return Date.UTC(date.getUTCFullYear() + step, 0, 1)
}

function formatTickLabel(timestamp: number, unit: TimelineTickUnit): string {
  const date = new Date(timestamp)
  if (unit === 'year') return String(date.getUTCFullYear())

  if (unit === 'month') {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date)
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export function generateTimelineTicks(
  range: TimelineDateRange,
  width: number,
  minimumSpacing = 96,
): TimelineTick[] {
  assertWidth(width)
  if (!Number.isFinite(minimumSpacing) || minimumSpacing <= 0) {
    throw new Error('Minimum tick spacing must be greater than zero')
  }

  const { unit, step } = resolveTickUnitAndStep(range, width, minimumSpacing)
  const timestamps: number[] = []
  let timestamp = firstAlignedTimestamp(range, unit, step)

  while (timestamp <= range.endMs) {
    timestamps.push(timestamp)
    timestamp = advanceTimestamp(timestamp, unit, step)
  }

  if (timestamps.length < 2) {
    timestamps.splice(0, timestamps.length, range.startMs, range.endMs)
  }

  return timestamps.map((tickTimestamp) => ({
    date: formatDate(tickTimestamp),
    label: formatTickLabel(tickTimestamp, unit),
    position:
      ((tickTimestamp - range.startMs) / (range.endMs - range.startMs)) * width,
    unit,
  }))
}

export const generateAdaptiveTicks = generateTimelineTicks

export function createTimelineLayerSegments(
  events: ReadonlyArray<TimelineEvent>,
): TimelineLayerSegment[] {
  const orderedEvents = [...events].sort(
    (left, right) =>
      left.startDate.localeCompare(right.startDate) ||
      (left.endDate ?? left.startDate).localeCompare(
        right.endDate ?? right.startDate,
      ) ||
      left.id.localeCompare(right.id),
  )

  const segments: TimelineLayerSegment[] = []
  let previousEndDate: string | undefined

  for (const event of orderedEvents) {
    const eventEndDate = event.endDate ?? event.startDate

    if (previousEndDate) {
      const gapDays =
        (parseDate(event.startDate) - parseDate(previousEndDate)) / DAY_IN_MS -
        1

      if (gapDays > 0) {
        segments.push({
          kind: 'gap',
          startDate: addDays(previousEndDate, 1),
          endDate: addDays(event.startDate, -1),
          durationDays: gapDays,
        })
      }
    }

    segments.push({
      kind: 'event',
      eventId: event.id,
      startDate: event.startDate,
      endDate: eventEndDate,
      durationDays:
        (parseDate(eventEndDate) - parseDate(event.startDate)) / DAY_IN_MS + 1,
    })
    previousEndDate = eventEndDate
  }

  return segments
}

export function layoutTimelineLayerSegments(
  events: ReadonlyArray<TimelineEvent>,
  range: TimelineDateRange,
  width: number,
): TimelineLayerSegmentLayout[] {
  assertWidth(width)

  return createTimelineLayerSegments(events).map((segment) => {
    const left = dateToPosition(segment.startDate, range, width)
    const endExclusive = dateToPosition(
      addDays(segment.endDate, 1),
      range,
      width,
    )

    return {
      segment,
      left,
      width: Math.max(1, endExclusive - left),
    }
  })
}

export function layoutTimelineEventCards(
  events: ReadonlyArray<TimelineEvent>,
  range: TimelineDateRange,
  width: number,
  options: { minimumLabelWidth?: number; gap?: number } = {},
): TimelineEventCardLayoutResult {
  assertWidth(width)
  const minimumLabelWidth = options.minimumLabelWidth ?? 160
  const gap = options.gap ?? 6

  if (!Number.isFinite(minimumLabelWidth) || minimumLabelWidth <= 0) {
    throw new Error('Minimum event label width must be greater than zero')
  }
  if (!Number.isFinite(gap) || gap < 0) {
    throw new Error('Event card gap cannot be negative')
  }

  const candidates = layoutTimelineLayerSegments(events, range, width)
    .flatMap((layout) => {
      if (layout.segment.kind !== 'event') return []

      const anchorX = layout.left + layout.width / 2
      const hitArea = fitHitArea(
        anchorX,
        Math.max(minimumLabelWidth, layout.width),
        width,
      )

      return [
        {
          eventId: layout.segment.eventId,
          left: hitArea.left,
          width: hitArea.width,
          anchorX,
        },
      ]
    })
    .sort(
      (left, right) =>
        left.left - right.left ||
        left.width - right.width ||
        left.eventId.localeCompare(right.eventId),
    )

  const rowEnds: number[] = []
  const cards = candidates.map((candidate) => {
    const availableRow = rowEnds.findIndex(
      (rowEnd) => rowEnd + gap <= candidate.left,
    )
    const row = availableRow < 0 ? rowEnds.length : availableRow
    rowEnds[row] = candidate.left + candidate.width

    return {
      ...candidate,
      side: row % 2 === 0 ? ('above' as const) : ('below' as const),
      level: Math.floor(row / 2),
    }
  })

  return {
    cards,
    aboveRowCount: Math.ceil(rowEnds.length / 2),
    belowRowCount: Math.floor(rowEnds.length / 2),
  }
}

function fitHitArea(
  center: number,
  desiredWidth: number,
  timelineWidth: number,
): { left: number; width: number } {
  const width = Math.min(desiredWidth, timelineWidth)
  return {
    left: clamp(center - width / 2, 0, timelineWidth - width),
    width,
  }
}

export function layoutTimelineEvents(
  events: ReadonlyArray<TimelineEvent>,
  range: TimelineDateRange,
  width: number,
  options: TimelineLayoutOptions = {},
): TimelineEventLayout[] {
  assertWidth(width)
  const minimumHitWidth = options.minimumHitWidth ?? 32
  if (!Number.isFinite(minimumHitWidth) || minimumHitWidth <= 0) {
    throw new Error('Minimum event hit width must be greater than zero')
  }
  const minimumLabelWidth = options.minimumLabelWidth ?? minimumHitWidth
  if (!Number.isFinite(minimumLabelWidth) || minimumLabelWidth <= 0) {
    throw new Error('Minimum event label width must be greater than zero')
  }

  return events.map((event) => {
    const startX = dateToPosition(event.startDate, range, width)
    const kind: TimelineEventKind = event.endDate ? 'duration' : 'point'
    const endX = event.endDate
      ? dateToPosition(event.endDate, range, width)
      : startX
    const barWidth = kind === 'duration' ? Math.max(2, endX - startX) : 2
    const center = kind === 'duration' ? startX + barWidth / 2 : startX
    const hitArea = fitHitArea(
      center,
      Math.max(minimumHitWidth, minimumLabelWidth, barWidth),
      width,
    )

    return {
      eventId: event.id,
      layerId: event.layerId,
      kind,
      startX,
      endX,
      barLeft: startX,
      barWidth,
      left: hitArea.left,
      width: hitArea.width,
    }
  })
}

export function packTimelineEventLayouts(
  layouts: ReadonlyArray<TimelineEventLayout>,
  gap = 6,
): PackedTimelineLayout {
  if (!Number.isFinite(gap) || gap < 0) {
    throw new Error('Event layout gap cannot be negative')
  }

  const rowEnds: number[] = []
  const events = [...layouts]
    .sort(
      (left, right) =>
        left.left - right.left ||
        left.width - right.width ||
        left.eventId.localeCompare(right.eventId),
    )
    .map((layout) => {
      const availableRow = rowEnds.findIndex(
        (rowEnd) => rowEnd + gap <= layout.left,
      )
      const row = availableRow < 0 ? rowEnds.length : availableRow
      rowEnds[row] = layout.left + layout.width
      return { ...layout, row }
    })

  return { events, rowCount: rowEnds.length }
}

export function layoutAndPackTimelineEvents(
  events: ReadonlyArray<TimelineEvent>,
  range: TimelineDateRange,
  width: number,
  options: TimelineLayoutOptions & { gap?: number } = {},
): PackedTimelineLayout {
  return packTimelineEventLayouts(
    layoutTimelineEvents(events, range, width, options),
    options.gap,
  )
}
