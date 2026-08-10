import type { TimelineRecord } from './model'

export interface TimelineExportFile {
  contents: string
  filename: string
  mimeType: string
}

export function createTimelineExport(
  timeline: TimelineRecord,
): TimelineExportFile {
  const basename = createExportBasename(timeline.title)
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

export function downloadTimelineExport(timeline: TimelineRecord): void {
  const file = createTimelineExport(timeline)
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
