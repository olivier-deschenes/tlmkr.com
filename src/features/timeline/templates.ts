import { addEvent, addLayer, createTimeline } from './operations'
import type { TimelineRecord } from './model'

/**
 * Starter timelines for the empty state. A blank canvas does not explain what
 * layers are for, and typing a dozen dates to find out is a poor first run.
 *
 * Dates are expressed as day offsets from the day the template is used, so a
 * starter always lands around today rather than in some fixed past year.
 */
export interface TimelineTemplate {
  id: string
  title: string
  description: string
  layers: Array<{ title: string; subtitle?: string; color: string }>
  events: Array<{
    layer: number
    title: string
    subtitle?: string
    color: string
    startOffset: number
    endOffset?: number
  }>
}

export const timelineTemplates: ReadonlyArray<TimelineTemplate> = [
  {
    id: 'product-roadmap',
    title: 'Product roadmap',
    description: 'Workstreams across a year, one lane per team.',
    layers: [
      { title: 'Platform', subtitle: 'Core infrastructure', color: '#2563eb' },
      { title: 'Product', subtitle: 'Customer-facing work', color: '#16a34a' },
      { title: 'Go-to-market', color: '#db2777' },
    ],
    events: [
      {
        layer: 0,
        title: 'Foundations',
        subtitle: 'Auth, billing, data model',
        color: '#2563eb',
        startOffset: -30,
        endOffset: 45,
      },
      {
        layer: 0,
        title: 'Scale-out',
        color: '#2563eb',
        startOffset: 46,
        endOffset: 150,
      },
      {
        layer: 1,
        title: 'Private beta',
        color: '#16a34a',
        startOffset: 0,
        endOffset: 60,
      },
      {
        layer: 1,
        title: 'Public launch',
        color: '#15803d',
        startOffset: 90,
        endOffset: 120,
      },
      {
        layer: 2,
        title: 'Launch campaign',
        subtitle: 'Paid and organic',
        color: '#db2777',
        startOffset: 80,
        endOffset: 140,
      },
    ],
  },
  {
    id: 'project-plan',
    title: 'Project plan',
    description: 'A single project broken into phases with a review gate.',
    layers: [
      { title: 'Delivery', color: '#7c3aed' },
      { title: 'Reviews', color: '#f59e0b' },
    ],
    events: [
      {
        layer: 0,
        title: 'Discovery',
        color: '#7c3aed',
        startOffset: 0,
        endOffset: 14,
      },
      {
        layer: 0,
        title: 'Build',
        color: '#7c3aed',
        startOffset: 15,
        endOffset: 60,
      },
      {
        layer: 0,
        title: 'Hardening',
        color: '#6d28d9',
        startOffset: 61,
        endOffset: 80,
      },
      { layer: 1, title: 'Kickoff review', color: '#f59e0b', startOffset: 1 },
      { layer: 1, title: 'Midpoint review', color: '#f59e0b', startOffset: 38 },
      { layer: 1, title: 'Go / no-go', color: '#d97706', startOffset: 81 },
    ],
  },
  {
    id: 'personal-history',
    title: 'Personal history',
    description: 'Long spans across decades, for a life or a company story.',
    layers: [
      { title: 'Chapters', color: '#0891b2' },
      { title: 'Milestones', color: '#e11d48' },
    ],
    events: [
      {
        layer: 0,
        title: 'Early years',
        color: '#0891b2',
        startOffset: -7300,
        endOffset: -3650,
      },
      {
        layer: 0,
        title: 'Building',
        color: '#0e7490',
        startOffset: -3649,
        endOffset: -365,
      },
      {
        layer: 0,
        title: 'Now',
        color: '#0891b2',
        startOffset: -364,
        endOffset: 0,
      },
      {
        layer: 1,
        title: 'First milestone',
        color: '#e11d48',
        startOffset: -5000,
      },
      {
        layer: 1,
        title: 'A turning point',
        color: '#e11d48',
        startOffset: -1200,
      },
    ],
  },
]

function offsetDate(offsetDays: number, from: Date): string {
  return new Date(from.getTime() + offsetDays * 86_400_000)
    .toISOString()
    .slice(0, 10)
}

export function createTimelineFromTemplate(
  template: TimelineTemplate,
  now: Date = new Date(),
): TimelineRecord {
  const [firstLayer, ...restLayers] = template.layers

  let timeline = createTimeline(template.title, {
    defaultLayerTitle: firstLayer.title,
    defaultLayerColor: firstLayer.color,
    now,
  })

  if (firstLayer.subtitle) {
    timeline = {
      ...timeline,
      layers: timeline.layers.map((layer, index) =>
        index === 0 ? { ...layer, subtitle: firstLayer.subtitle } : layer,
      ),
    }
  }

  for (const layer of restLayers) {
    timeline = addLayer(
      timeline,
      { title: layer.title, subtitle: layer.subtitle, color: layer.color },
      { now },
    )
  }

  const orderedLayers = [...timeline.layers].sort(
    (left, right) => left.order - right.order,
  )

  for (const event of template.events) {
    timeline = addEvent(
      timeline,
      {
        title: event.title,
        subtitle: event.subtitle,
        color: event.color,
        layerId: orderedLayers[event.layer].id,
        startDate: offsetDate(event.startOffset, now),
        endDate:
          event.endOffset === undefined
            ? undefined
            : offsetDate(event.endOffset, now),
      },
      { now },
    )
  }

  return timeline
}
