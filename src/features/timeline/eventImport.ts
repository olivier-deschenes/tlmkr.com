import { z } from 'zod'

import {
  colorSchema,
  isoDateSchema,
  type TimelineEventInput,
  type TimelineRecord,
} from './model'
import { addEvent, DEFAULT_EVENT_COLOR, EventOverlapError } from './operations'

const requiredTextSchema = z.string().trim().min(1)
const optionalTextSchema = z.string().trim().min(1).optional()

export const importedEventSchema = z
  .object({
    title: requiredTextSchema,
    layer: requiredTextSchema,
    startDate: isoDateSchema,
    endDate: isoDateSchema.optional(),
    subtitle: optionalTextSchema,
    description: optionalTextSchema,
    color: colorSchema.optional(),
  })
  .strict()
  .refine(
    ({ startDate, endDate }) => endDate === undefined || endDate >= startDate,
    {
      message: 'End date must be on or after start date',
      path: ['endDate'],
    },
  )

export const eventImportSchema = z
  .object({
    events: z.array(importedEventSchema).min(1).max(500),
  })
  .strict()

export type ImportedEvent = z.infer<typeof importedEventSchema>

interface ImportEventsOptions {
  idFactory?: () => string
  now?: string | Date
}

export class EventImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EventImportError'
  }
}

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>((result, part) => {
    if (typeof part === 'number') return `${result}[${part}]`
    return result ? `${result}.${String(part)}` : String(part)
  }, '')
}

function formatValidationError(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => {
      const path = formatPath(issue.path)
      return path ? `${path}: ${issue.message}` : issue.message
    })
    .join(' ')
}

export function parseEventImport(json: string): Array<ImportedEvent> {
  let value: unknown

  try {
    value = JSON.parse(json)
  } catch {
    throw new EventImportError(
      'This is not valid JSON. Check for missing quotes, commas, or brackets.',
    )
  }

  const result = eventImportSchema.safeParse(value)
  if (!result.success) {
    throw new EventImportError(formatValidationError(result.error))
  }

  return result.data.events
}

function resolveLayerId(timeline: TimelineRecord, layerTitle: string): string {
  const normalizedTitle = layerTitle.toLocaleLowerCase()
  const matchingLayers = timeline.layers.filter(
    (layer) => layer.title.toLocaleLowerCase() === normalizedTitle,
  )

  if (matchingLayers.length === 0) {
    throw new EventImportError(
      `No layer named \"${layerTitle}\" exists in this timeline.`,
    )
  }

  if (matchingLayers.length > 1) {
    throw new EventImportError(
      `More than one layer is named \"${layerTitle}\". Rename one of them before importing.`,
    )
  }

  return matchingLayers[0].id
}

export function importEventsFromJson(
  timeline: TimelineRecord,
  json: string,
  options: ImportEventsOptions = {},
): TimelineRecord {
  const events = parseEventImport(json)
  const inputs: Array<TimelineEventInput> = events.map((event) => ({
    title: event.title,
    layerId: resolveLayerId(timeline, event.layer),
    startDate: event.startDate,
    endDate: event.endDate,
    subtitle: event.subtitle,
    description: event.description,
    color: event.color ?? DEFAULT_EVENT_COLOR,
  }))

  try {
    return inputs.reduce(
      (nextTimeline, input) =>
        addEvent(nextTimeline, input, {
          id: options.idFactory?.(),
          now: options.now,
        }),
      timeline,
    )
  } catch (error) {
    if (error instanceof EventOverlapError) {
      throw new EventImportError(error.message)
    }
    throw error
  }
}

/**
 * The prompt travels on its own — into a link or onto the clipboard — so it has
 * to carry the format and the layer names with it.
 */
export function createEventPrompt(timeline: TimelineRecord): string {
  const layerTitles = [...timeline.layers]
    .sort((left, right) => left.order - right.order)
    .map((layer) => `- ${layer.title}`)
    .join('\n')

  return `You are helping me add events to a timeline named \"${timeline.title}\".

First, ask me what events I want to add. After I answer, return only one valid JSON object in exactly this shape:
{
  \"events\": [
    {
      \"title\": \"Required event title\",
      \"layer\": \"Required exact layer title\",
      \"startDate\": \"YYYY-MM-DD\",
      \"endDate\": \"YYYY-MM-DD\",
      \"subtitle\": \"Optional short subtitle\",
      \"description\": \"Optional details\",
      \"color\": \"#2563eb\"
    }
  ]
}

Available layers (the layer value must match one exactly):
${layerTitles}

Rules:
- Return valid JSON only, with no markdown code fences or commentary.
- Use real calendar dates in YYYY-MM-DD format.
- Omit endDate for a one-day event. For a date range, endDate must be on or after startDate.
- Events assigned to the same layer must not share any dates; date ranges are inclusive.
- subtitle, description, endDate, and color are optional. Omit optional fields when they are unknown.
- If included, color must be a six-digit hex color such as #2563eb.
- Do not include IDs or any fields not shown above.
- If my request is ambiguous or missing dates, ask concise follow-up questions before producing the final JSON.`
}

export interface AssistantLink {
  label: string
  url: string
}

/**
 * Each assistant opens a new chat with the prompt already in the composer via
 * its own `q` parameter. Gemini is the shaky one: it opens the app but may drop
 * the parameter, which is why the prompt can also be copied.
 */
export function createAssistantLinks(prompt: string): AssistantLink[] {
  return [
    { label: 'ChatGPT', base: 'https://chatgpt.com/' },
    { label: 'Claude', base: 'https://claude.ai/new' },
    { label: 'Gemini', base: 'https://gemini.google.com/app' },
  ].map(({ label, base }) => {
    const url = new URL(base)
    url.searchParams.set('q', prompt)
    return { label, url: url.toString() }
  })
}
