import {
  layerSchema,
  timelineEventSchema,
  timelineEventsOverlap,
  timelineRecordSchema,
  TIMELINE_SCHEMA_VERSION,
} from './model'
import type {
  Layer,
  LayerInput,
  TimelineEvent,
  TimelineEventInput,
  TimelineRecord,
} from './model'

export const DEFAULT_LAYER_COLOR = '#64748b'
export const DEFAULT_EVENT_COLOR = '#2563eb'

type Timestamp = string | Date

interface TimestampOptions {
  now?: Timestamp
}

interface EntityOptions extends TimestampOptions {
  id?: string
}

export interface CreateTimelineOptions extends TimestampOptions {
  timelineId?: string
  defaultLayerId?: string
  defaultLayerTitle?: string
  defaultLayerColor?: string
}

export type LayerPatch = Partial<LayerInput>
export type TimelineEventPatch = Partial<TimelineEventInput>
export type LayerMoveDirection = 'up' | 'down'

export class EventOverlapError extends Error {
  constructor(event: TimelineEvent, conflictingEvent: TimelineEvent) {
    super(
      `“${event.title}” overlaps “${conflictingEvent.title}”. Events on the same layer cannot share dates.`,
    )
    this.name = 'EventOverlapError'
  }
}

const createId = () => crypto.randomUUID()

function toTimestamp(timestamp: Timestamp | undefined): string {
  if (timestamp === undefined) return new Date().toISOString()
  return timestamp instanceof Date ? timestamp.toISOString() : timestamp
}

function requireLayer(timeline: TimelineRecord, layerId: string): Layer {
  const layer = timeline.layers.find((candidate) => candidate.id === layerId)
  if (!layer) throw new Error(`Layer ${layerId} does not exist`)
  return layer
}

function requireEvent(
  timeline: TimelineRecord,
  eventId: string,
): TimelineEvent {
  const event = timeline.events.find((candidate) => candidate.id === eventId)
  if (!event) throw new Error(`Event ${eventId} does not exist`)
  return event
}

function requireNoEventOverlap(
  timeline: TimelineRecord,
  event: TimelineEvent,
  ignoredEventId?: string,
): void {
  const conflict = timeline.events.find(
    (candidate) =>
      candidate.id !== ignoredEventId &&
      timelineEventsOverlap(event, candidate),
  )
  if (conflict) throw new EventOverlapError(event, conflict)
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

function addDays(date: string, days: number): string {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`)
  return new Date(timestamp + days * MILLISECONDS_PER_DAY)
    .toISOString()
    .slice(0, 10)
}

function durationInDays(event: TimelineEvent): number {
  if (!event.endDate) return 0
  return (
    (Date.parse(`${event.endDate}T00:00:00.000Z`) -
      Date.parse(`${event.startDate}T00:00:00.000Z`)) /
    MILLISECONDS_PER_DAY
  )
}

function nextAvailableDuplicate(
  timeline: TimelineRecord,
  source: TimelineEvent,
  id: string,
): TimelineEvent {
  const duration = durationInDays(source)
  let startDate = addDays(source.endDate ?? source.startDate, 1)

  while (true) {
    const copy = timelineEventSchema.parse({
      ...source,
      id,
      title: `${source.title} copy`,
      startDate,
      endDate: source.endDate ? addDays(startDate, duration) : undefined,
    })
    const conflict = timeline.events.find((event) =>
      timelineEventsOverlap(copy, event),
    )
    if (!conflict) return copy
    startDate = addDays(conflict.endDate ?? conflict.startDate, 1)
  }
}

function updateTimeline(
  timeline: TimelineRecord,
  changes: Partial<Pick<TimelineRecord, 'title' | 'layers' | 'events'>>,
  now: Timestamp | undefined,
): TimelineRecord {
  return timelineRecordSchema.parse({
    ...timeline,
    ...changes,
    updatedAt: toTimestamp(now),
  })
}

export function createTimeline(
  title: string,
  options: CreateTimelineOptions = {},
): TimelineRecord {
  const timestamp = toTimestamp(options.now)

  return timelineRecordSchema.parse({
    schemaVersion: TIMELINE_SCHEMA_VERSION,
    id: options.timelineId ?? createId(),
    title,
    createdAt: timestamp,
    updatedAt: timestamp,
    layers: [
      {
        id: options.defaultLayerId ?? createId(),
        title: options.defaultLayerTitle ?? 'Layer 1',
        color: options.defaultLayerColor ?? DEFAULT_LAYER_COLOR,
        order: 0,
      },
    ],
    events: [],
  })
}

export function updateTimelineTitle(
  timeline: TimelineRecord,
  title: string,
  options: TimestampOptions = {},
): TimelineRecord {
  return updateTimeline(timeline, { title }, options.now)
}

export function addLayer(
  timeline: TimelineRecord,
  input: LayerInput,
  options: EntityOptions = {},
): TimelineRecord {
  const layer = layerSchema.parse({
    ...input,
    id: options.id ?? createId(),
    order: timeline.layers.length,
  })

  return updateTimeline(
    timeline,
    { layers: [...timeline.layers, layer] },
    options.now,
  )
}

export function updateLayer(
  timeline: TimelineRecord,
  layerId: string,
  patch: LayerPatch,
  options: TimestampOptions = {},
): TimelineRecord {
  const current = requireLayer(timeline, layerId)
  const updated = layerSchema.parse({ ...current, ...patch })

  return updateTimeline(
    timeline,
    {
      layers: timeline.layers.map((layer) =>
        layer.id === layerId ? updated : layer,
      ),
    },
    options.now,
  )
}

export function reorderLayers(
  timeline: TimelineRecord,
  orderedLayerIds: ReadonlyArray<string>,
  options: TimestampOptions = {},
): TimelineRecord {
  if (orderedLayerIds.length !== timeline.layers.length) {
    throw new Error('Layer order must include every layer exactly once')
  }

  const layerById = new Map(timeline.layers.map((layer) => [layer.id, layer]))
  const uniqueIds = new Set(orderedLayerIds)
  if (
    uniqueIds.size !== timeline.layers.length ||
    orderedLayerIds.some((id) => !layerById.has(id))
  ) {
    throw new Error('Layer order must include every layer exactly once')
  }

  const layers = orderedLayerIds.map((id, order) => {
    const layer = layerById.get(id)
    if (!layer) throw new Error(`Layer ${id} does not exist`)
    return { ...layer, order }
  })

  return updateTimeline(timeline, { layers }, options.now)
}

export function moveLayer(
  timeline: TimelineRecord,
  layerId: string,
  direction: LayerMoveDirection,
  options: TimestampOptions = {},
): TimelineRecord {
  requireLayer(timeline, layerId)
  const orderedIds = [...timeline.layers]
    .sort((left, right) => left.order - right.order)
    .map((layer) => layer.id)
  const currentIndex = orderedIds.indexOf(layerId)
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

  if (targetIndex < 0 || targetIndex >= orderedIds.length) return timeline

  const currentId = orderedIds[currentIndex]
  orderedIds[currentIndex] = orderedIds[targetIndex]
  orderedIds[targetIndex] = currentId
  return reorderLayers(timeline, orderedIds, options)
}

export function deleteLayer(
  timeline: TimelineRecord,
  layerId: string,
  options: TimestampOptions = {},
): TimelineRecord {
  requireLayer(timeline, layerId)
  const layers = timeline.layers
    .filter((layer) => layer.id !== layerId)
    .sort((left, right) => left.order - right.order)
    .map((layer, order) => ({ ...layer, order }))
  const events = timeline.events.filter((event) => event.layerId !== layerId)

  return updateTimeline(timeline, { layers, events }, options.now)
}

export function addEvent(
  timeline: TimelineRecord,
  input: TimelineEventInput,
  options: EntityOptions = {},
): TimelineRecord {
  requireLayer(timeline, input.layerId)
  const event = timelineEventSchema.parse({
    ...input,
    id: options.id ?? createId(),
  })
  requireNoEventOverlap(timeline, event)

  return updateTimeline(
    timeline,
    { events: [...timeline.events, event] },
    options.now,
  )
}

export function updateEvent(
  timeline: TimelineRecord,
  eventId: string,
  patch: TimelineEventPatch,
  options: TimestampOptions = {},
): TimelineRecord {
  const current = requireEvent(timeline, eventId)
  if (patch.layerId !== undefined) requireLayer(timeline, patch.layerId)
  const updated = timelineEventSchema.parse({ ...current, ...patch })
  requireNoEventOverlap(timeline, updated, eventId)

  return updateTimeline(
    timeline,
    {
      events: timeline.events.map((event) =>
        event.id === eventId ? updated : event,
      ),
    },
    options.now,
  )
}

export function duplicateEvent(
  timeline: TimelineRecord,
  eventId: string,
  options: EntityOptions = {},
): TimelineRecord {
  const source = requireEvent(timeline, eventId)
  const copy = nextAvailableDuplicate(
    timeline,
    source,
    options.id ?? createId(),
  )

  return updateTimeline(
    timeline,
    { events: [...timeline.events, copy] },
    options.now,
  )
}

export function deleteEvent(
  timeline: TimelineRecord,
  eventId: string,
  options: TimestampOptions = {},
): TimelineRecord {
  requireEvent(timeline, eventId)
  return updateTimeline(
    timeline,
    { events: timeline.events.filter((event) => event.id !== eventId) },
    options.now,
  )
}

export function deleteTimeline(
  timelines: ReadonlyArray<TimelineRecord>,
  timelineId: string,
): TimelineRecord[] {
  return timelines.filter((timeline) => timeline.id !== timelineId)
}

export function selectTimelineAfterDeletion(
  timelines: ReadonlyArray<TimelineRecord>,
  deletedTimelineId: string,
  selectedTimelineId: string | undefined,
): string | undefined {
  const remaining = deleteTimeline(timelines, deletedTimelineId)
  if (remaining.length === 0) return undefined

  if (
    selectedTimelineId !== deletedTimelineId &&
    remaining.some((timeline) => timeline.id === selectedTimelineId)
  ) {
    return selectedTimelineId
  }

  const deletedIndex = timelines.findIndex(
    (timeline) => timeline.id === deletedTimelineId,
  )
  if (deletedIndex < 0) return remaining[0].id
  return remaining[Math.min(deletedIndex, remaining.length - 1)].id
}
