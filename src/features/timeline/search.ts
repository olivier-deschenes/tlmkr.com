import type { TimelineEvent, TimelineLayer, TimelineRecord } from './model'

/**
 * Search dims rather than filters: hiding events would change the date range
 * and the lane packing under the reader, so the shape of the timeline would
 * shift every keystroke. Keeping every event in place and fading the misses
 * preserves the layout as a stable frame of reference.
 */
export interface TimelineSearchResult {
  /** Ids of events matching the query. Empty query means every event. */
  matchedEventIds: ReadonlySet<string>
  matchCount: number
  isActive: boolean
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase()
}

export function eventMatchesQuery(
  event: TimelineEvent,
  layer: TimelineLayer | undefined,
  query: string,
): boolean {
  const needle = normalize(query)
  if (!needle) return true

  return [
    event.title,
    event.subtitle,
    event.description,
    event.startDate,
    event.endDate,
    layer?.title,
  ].some((field) => field && field.toLocaleLowerCase().includes(needle))
}

export function searchTimeline(
  timeline: TimelineRecord,
  query: string,
): TimelineSearchResult {
  const isActive = normalize(query).length > 0
  if (!isActive) {
    return {
      matchedEventIds: new Set(timeline.events.map((event) => event.id)),
      matchCount: timeline.events.length,
      isActive: false,
    }
  }

  const layerById = new Map(timeline.layers.map((layer) => [layer.id, layer]))
  const matchedEventIds = new Set(
    timeline.events
      .filter((event) =>
        eventMatchesQuery(event, layerById.get(event.layerId), query),
      )
      .map((event) => event.id),
  )

  return { matchedEventIds, matchCount: matchedEventIds.size, isActive: true }
}
