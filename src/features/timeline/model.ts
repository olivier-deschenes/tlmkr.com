import { z } from 'zod'

export const TIMELINE_SCHEMA_VERSION = 1 as const

const requiredTitleSchema = z.string().trim().min(1)
const optionalSubtitleSchema = z.string().trim().optional()
const optionalDescriptionSchema = z.string().trim().optional()

export const colorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, 'Color must be a six-digit hex value')

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    )
  }, 'Date must be a valid calendar date')

export const layerSchema = z.object({
  id: z.string().uuid(),
  title: requiredTitleSchema,
  subtitle: optionalSubtitleSchema,
  description: optionalDescriptionSchema,
  color: colorSchema,
  order: z.number().int().nonnegative(),
})

export const timelineEventSchema = z
  .object({
    id: z.string().uuid(),
    layerId: z.string().uuid(),
    title: requiredTitleSchema,
    subtitle: optionalSubtitleSchema,
    description: optionalDescriptionSchema,
    color: colorSchema,
    startDate: isoDateSchema,
    endDate: isoDateSchema.optional(),
  })
  .refine(
    ({ startDate, endDate }) => endDate === undefined || endDate >= startDate,
    {
      message: 'End date must be on or after start date',
      path: ['endDate'],
    },
  )

type EventDateRange = Pick<
  z.infer<typeof timelineEventSchema>,
  'layerId' | 'startDate' | 'endDate'
>

export function timelineEventsOverlap(
  left: EventDateRange,
  right: EventDateRange,
): boolean {
  if (left.layerId !== right.layerId) return false

  const leftEnd = left.endDate ?? left.startDate
  const rightEnd = right.endDate ?? right.startDate
  return left.startDate <= rightEnd && right.startDate <= leftEnd
}

export const timelineRecordSchema = z
  .object({
    schemaVersion: z.literal(TIMELINE_SCHEMA_VERSION),
    id: z.string().uuid(),
    title: requiredTitleSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    layers: z.array(layerSchema),
    events: z.array(timelineEventSchema),
  })
  .superRefine((timeline, context) => {
    const layerIds = new Set<string>()
    const layerOrders = new Set<number>()

    timeline.layers.forEach((layer, index) => {
      if (layerIds.has(layer.id)) {
        context.addIssue({
          code: 'custom',
          message: 'Layer IDs must be unique',
          path: ['layers', index, 'id'],
        })
      }
      layerIds.add(layer.id)

      if (layerOrders.has(layer.order)) {
        context.addIssue({
          code: 'custom',
          message: 'Layer order values must be unique',
          path: ['layers', index, 'order'],
        })
      }
      layerOrders.add(layer.order)
    })

    timeline.layers.forEach((_, expectedOrder) => {
      if (!layerOrders.has(expectedOrder)) {
        context.addIssue({
          code: 'custom',
          message:
            'Layer order values must form a contiguous zero-based sequence',
          path: ['layers'],
        })
      }
    })

    const eventIds = new Set<string>()
    timeline.events.forEach((event, index) => {
      if (eventIds.has(event.id)) {
        context.addIssue({
          code: 'custom',
          message: 'Event IDs must be unique',
          path: ['events', index, 'id'],
        })
      }
      eventIds.add(event.id)

      if (!layerIds.has(event.layerId)) {
        context.addIssue({
          code: 'custom',
          message: 'Event must reference an existing layer',
          path: ['events', index, 'layerId'],
        })
      }

      const conflictsWithEarlierEvent = timeline.events.some(
        (candidate, candidateIndex) =>
          candidateIndex < index && timelineEventsOverlap(event, candidate),
      )
      if (conflictsWithEarlierEvent) {
        context.addIssue({
          code: 'custom',
          message: 'Events on the same layer cannot overlap',
          path: ['events', index, 'startDate'],
        })
      }
    })
  })

export type Layer = z.infer<typeof layerSchema>
export type TimelineLayer = Layer
export type TimelineEvent = z.infer<typeof timelineEventSchema>
export type TimelineRecord = z.infer<typeof timelineRecordSchema>

export type LayerInput = Omit<Layer, 'id' | 'order'>
export type TimelineEventInput = Omit<TimelineEvent, 'id'>
