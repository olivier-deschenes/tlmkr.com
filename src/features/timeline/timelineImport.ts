import type { ZodError } from 'zod'

import { timelineRecordSchema } from './model'
import type { TimelineRecord } from './model'

interface ImportTimelineOptions {
  existingIds?: Iterable<string>
  idFactory?: () => string
}

export class TimelineImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimelineImportError'
  }
}

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>((result, part) => {
    if (typeof part === 'number') return `${result}[${part}]`
    return result ? `${result}.${String(part)}` : String(part)
  }, '')
}

function formatValidationError(error: ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => {
      const path = formatPath(issue.path)
      return path ? `${path}: ${issue.message}` : issue.message
    })
    .join(' ')
}

export function parseTimelineImport(json: string): TimelineRecord {
  let value: unknown

  try {
    value = JSON.parse(json)
  } catch {
    throw new TimelineImportError(
      'This is not valid JSON. Check for missing quotes, commas, or brackets.',
    )
  }

  const result = timelineRecordSchema.safeParse(value)
  if (!result.success) {
    throw new TimelineImportError(formatValidationError(result.error))
  }

  return result.data
}

export function importTimelineFromJson(
  json: string,
  options: ImportTimelineOptions = {},
): TimelineRecord {
  const timeline = parseTimelineImport(json)
  const existingIds = new Set(options.existingIds)

  if (!existingIds.has(timeline.id)) return timeline

  const idFactory = options.idFactory ?? (() => crypto.randomUUID())
  let id = idFactory()
  while (existingIds.has(id)) id = idFactory()

  return timelineRecordSchema.parse({ ...timeline, id })
}
