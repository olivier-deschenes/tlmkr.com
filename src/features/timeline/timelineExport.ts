import type { TimelineRecord } from './model'

export type TimelineExportFormat = 'json' | 'csv'

const CSV_COLUMNS = [
  'layer',
  'layerSubtitle',
  'layerDescription',
  'event',
  'eventSubtitle',
  'eventDescription',
  'startDate',
  'endDate',
  'color',
] as const

export interface TimelineExportFile {
  contents: string
  filename: string
  mimeType: string
}

export function createTimelineExport(
  timeline: TimelineRecord,
  format: TimelineExportFormat,
): TimelineExportFile {
  const basename = createExportBasename(timeline.title)

  if (format === 'json') {
    const exportableTimeline: TimelineRecord = {
      schemaVersion: timeline.schemaVersion,
      id: timeline.id,
      title: timeline.title,
      createdAt: timeline.createdAt,
      updatedAt: timeline.updatedAt,
      layers: timeline.layers,
      events: timeline.events,
    }

    return {
      contents: `${JSON.stringify(exportableTimeline, null, 2)}\n`,
      filename: `${basename}.json`,
      mimeType: 'application/json;charset=utf-8',
    }
  }

  const orderedLayers = [...timeline.layers].sort(
    (left, right) => left.order - right.order,
  )
  const rows = orderedLayers.flatMap((layer) => {
    const events = timeline.events
      .filter((event) => event.layerId === layer.id)
      .sort(
        (left, right) =>
          left.startDate.localeCompare(right.startDate) ||
          left.title.localeCompare(right.title),
      )

    if (events.length === 0) {
      return [
        [
          layer.title,
          layer.subtitle,
          layer.description,
          '',
          '',
          '',
          '',
          '',
          layer.color,
        ],
      ]
    }

    return events.map((event) => [
      layer.title,
      layer.subtitle,
      layer.description,
      event.title,
      event.subtitle,
      event.description,
      event.startDate,
      event.endDate,
      event.color,
    ])
  })

  return {
    contents: [CSV_COLUMNS, ...rows]
      .map((row) => row.map((value) => escapeCsvCell(value ?? '')).join(','))
      .join('\r\n'),
    filename: `${basename}.csv`,
    mimeType: 'text/csv;charset=utf-8',
  }
}

export function downloadTimelineExport(
  timeline: TimelineRecord,
  format: TimelineExportFormat,
): void {
  const file = createTimelineExport(timeline, format)
  const url = URL.createObjectURL(
    new Blob([file.contents], { type: file.mimeType }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = file.filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function createExportBasename(title: string): string {
  const normalized = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'timeline'
}

function escapeCsvCell(value: string): string {
  if (!/[",\r\n]/.test(value)) return value
  return `"${value.replace(/"/g, '""')}"`
}
