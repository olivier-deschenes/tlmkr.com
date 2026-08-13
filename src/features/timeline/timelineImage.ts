import {
  TIMELINE_GEOMETRY,
  calculateCardTop,
  calculateDateRange,
  calculateLaneMetrics,
  dateToPosition,
  generateTimelineTicks,
  isDateInRange,
  layoutTimelineEventCards,
  layoutTimelineLayerSegments,
  todayIsoDate,
} from './layout'
import type { TimelineDateRange } from './layout'
import { formatEventDuration } from './duration'
import { createExportBasename } from './timelineExport'
import type { TimelineEvent, TimelineRecord } from './model'

const AXIS_HEIGHT = 56
const LABEL_COLUMN_WIDTH = 200
const HEADER_HEIGHT = 64
const FOOTER_HEIGHT = 34
const PADDING = 24
/**
 * Wider than the on-screen floor: a static image has no tooltips to fall back
 * on, so a card has to hold its full date range and duration without eliding.
 */
const EXPORT_LABEL_WIDTH = 215

/**
 * The exported image has to survive being opened anywhere, so it names only
 * generic font families and paints explicit colors rather than inheriting the
 * app's CSS custom properties.
 */
const FONT_STACK =
  "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

interface ImageTheme {
  background: string
  card: string
  foreground: string
  muted: string
  border: string
  accent: string
}

const lightTheme: ImageTheme = {
  background: '#ffffff',
  card: '#ffffff',
  foreground: '#111827',
  muted: '#6b7280',
  border: '#e5e7eb',
  accent: '#111827',
}

const darkTheme: ImageTheme = {
  background: '#0f1115',
  card: '#151922',
  foreground: '#f3f4f6',
  muted: '#9ca3af',
  border: '#2b313d',
  accent: '#e5e7eb',
}

export interface TimelineImageOptions {
  width?: number
  /** Restrict the image to a viewport; defaults to the whole timeline. */
  range?: TimelineDateRange | null
  theme?: 'light' | 'dark'
  scale?: number
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * SVG has no text overflow, so long labels are cut to fit their box. The
 * average glyph in this stack is a little over half the font size wide.
 */
function truncateToWidth(
  value: string,
  maxWidth: number,
  fontSize: number,
): string {
  const averageGlyphWidth = fontSize * 0.55
  const maxCharacters = Math.floor(maxWidth / averageGlyphWidth)
  if (maxCharacters <= 1) return ''
  if (value.length <= maxCharacters) return value
  return `${value.slice(0, Math.max(1, maxCharacters - 1))}…`
}

function eventDateLabel(event: TimelineEvent): string {
  return event.endDate
    ? `${event.startDate} → ${event.endDate}`
    : event.startDate
}

export function createTimelineSvg(
  timeline: TimelineRecord,
  options: TimelineImageOptions = {},
): string {
  const width = options.width ?? 1600
  const theme = options.theme === 'dark' ? darkTheme : lightTheme
  const laneWidth = width - LABEL_COLUMN_WIDTH - PADDING * 2
  const contentRange = calculateDateRange(timeline.events)
  const range = options.range ?? contentRange
  const orderedLayers = [...timeline.layers].sort(
    (left, right) => left.order - right.order,
  )

  const lanes = orderedLayers.map((layer) => {
    const events = timeline.events.filter((event) => event.layerId === layer.id)
    if (!range || laneWidth <= 0) {
      return {
        layer,
        events,
        segments: [],
        cards: [],
        metrics: calculateLaneMetrics({ aboveRowCount: 0, belowRowCount: 0 }),
      }
    }

    const cardLayout = layoutTimelineEventCards(events, range, laneWidth, {
      minimumLabelWidth: EXPORT_LABEL_WIDTH,
      gap: 6,
    })

    return {
      layer,
      events,
      segments: layoutTimelineLayerSegments(events, range, laneWidth),
      cards: cardLayout.cards,
      metrics: calculateLaneMetrics(cardLayout),
    }
  })

  const laneTops: Array<number> = []
  let cursor = PADDING + HEADER_HEIGHT + AXIS_HEIGHT
  for (const lane of lanes) {
    laneTops.push(cursor)
    cursor += Math.max(lane.metrics.height, 96)
  }
  const height = cursor + FOOTER_HEIGHT + PADDING

  const eventById = new Map(timeline.events.map((event) => [event.id, event]))
  const parts: Array<string> = []

  parts.push(
    `<rect width="${width}" height="${height}" fill="${theme.background}"/>`,
  )

  parts.push(
    `<text x="${PADDING}" y="${PADDING + 26}" font-family="${FONT_STACK}" font-size="22" font-weight="600" fill="${theme.foreground}">${escapeXml(
      truncateToWidth(timeline.title, width - PADDING * 2, 22),
    )}</text>`,
  )
  const summary = [
    `${timeline.layers.length} ${timeline.layers.length === 1 ? 'layer' : 'layers'}`,
    `${timeline.events.length} ${timeline.events.length === 1 ? 'event' : 'events'}`,
    range ? `${range.startDate} — ${range.endDate}` : null,
  ]
    .filter(Boolean)
    .join('  ·  ')
  parts.push(
    `<text x="${PADDING}" y="${PADDING + 46}" font-family="${FONT_STACK}" font-size="12" fill="${theme.muted}">${escapeXml(summary)}</text>`,
  )

  const axisTop = PADDING + HEADER_HEIGHT
  const laneLeft = PADDING + LABEL_COLUMN_WIDTH

  if (range && laneWidth > 0) {
    for (const tick of generateTimelineTicks(range, laneWidth)) {
      const x = laneLeft + tick.position
      parts.push(
        `<line x1="${x}" y1="${axisTop}" x2="${x}" y2="${cursor}" stroke="${theme.border}" stroke-width="1"/>`,
      )
      parts.push(
        `<text x="${x}" y="${axisTop + AXIS_HEIGHT - 14}" text-anchor="middle" font-family="${FONT_STACK}" font-size="10" fill="${theme.muted}">${escapeXml(tick.label)}</text>`,
      )
    }

    const today = todayIsoDate()
    if (isDateInRange(today, range)) {
      const x = laneLeft + dateToPosition(today, range, laneWidth)
      parts.push(
        `<line x1="${x}" y1="${axisTop}" x2="${x}" y2="${cursor}" stroke="${theme.accent}" stroke-width="1" stroke-dasharray="3 3" opacity="0.6"/>`,
      )
      parts.push(
        `<text x="${x}" y="${axisTop + 12}" text-anchor="middle" font-family="${FONT_STACK}" font-size="9" font-weight="600" fill="${theme.accent}">TODAY</text>`,
      )
    }
  }

  parts.push(
    `<line x1="${PADDING}" y1="${axisTop + AXIS_HEIGHT}" x2="${width - PADDING}" y2="${axisTop + AXIS_HEIGHT}" stroke="${theme.border}" stroke-width="1"/>`,
  )

  lanes.forEach((lane, index) => {
    const top = laneTops[index]
    const laneHeight = Math.max(lane.metrics.height, 96)
    const anchorY = top + lane.metrics.anchorY

    if (index > 0) {
      parts.push(
        `<line x1="${PADDING}" y1="${top}" x2="${width - PADDING}" y2="${top}" stroke="${theme.border}" stroke-width="1"/>`,
      )
    }

    parts.push(
      `<circle cx="${PADDING + 5}" cy="${top + 20}" r="4" fill="${lane.layer.color}"/>`,
    )
    parts.push(
      `<text x="${PADDING + 16}" y="${top + 24}" font-family="${FONT_STACK}" font-size="13" font-weight="500" fill="${theme.foreground}">${escapeXml(
        truncateToWidth(lane.layer.title, LABEL_COLUMN_WIDTH - 24, 13),
      )}</text>`,
    )
    if (lane.layer.subtitle) {
      parts.push(
        `<text x="${PADDING + 16}" y="${top + 40}" font-family="${FONT_STACK}" font-size="11" fill="${theme.muted}">${escapeXml(
          truncateToWidth(lane.layer.subtitle, LABEL_COLUMN_WIDTH - 24, 11),
        )}</text>`,
      )
    }
    parts.push(
      `<text x="${PADDING + 16}" y="${top + (lane.layer.subtitle ? 56 : 40)}" font-family="${FONT_STACK}" font-size="10" fill="${theme.muted}">${escapeXml(
        `${lane.events.length} ${lane.events.length === 1 ? 'event' : 'events'}`,
      )}</text>`,
    )

    if (lane.events.length > 0) {
      parts.push(
        `<line x1="${laneLeft}" y1="${anchorY}" x2="${laneLeft + laneWidth}" y2="${anchorY}" stroke="${theme.border}" stroke-width="1"/>`,
      )
    }

    for (const layout of lane.segments) {
      if (layout.segment.kind !== 'event') continue
      const event = eventById.get(layout.segment.eventId)
      if (!event) continue

      parts.push(
        `<rect x="${laneLeft + layout.left}" y="${anchorY - 1.5}" width="${Math.max(2, layout.width)}" height="3" rx="1.5" fill="${event.color}"/>`,
      )
    }

    for (const card of lane.cards) {
      const event = eventById.get(card.eventId)
      if (!event) continue

      const cardTop = top + calculateCardTop(card, lane.metrics)
      const cardLeft = laneLeft + card.left
      const anchorX = laneLeft + card.anchorX
      const connectorTop =
        card.side === 'above' ? cardTop + TIMELINE_GEOMETRY.cardHeight : anchorY
      const connectorBottom = card.side === 'above' ? anchorY : cardTop

      parts.push(
        `<line x1="${anchorX}" y1="${connectorTop}" x2="${anchorX}" y2="${connectorBottom}" stroke="${theme.border}" stroke-width="1"/>`,
      )
      parts.push(
        `<circle cx="${anchorX}" cy="${anchorY}" r="3.5" fill="${theme.card}" stroke="${event.color}" stroke-width="2"/>`,
      )
      parts.push(
        `<rect x="${cardLeft}" y="${cardTop}" width="${card.width}" height="${TIMELINE_GEOMETRY.cardHeight}" fill="${theme.card}" stroke="${theme.border}" stroke-width="1"/>`,
      )
      parts.push(
        `<rect x="${cardLeft}" y="${cardTop}" width="${card.width}" height="4" fill="${event.color}"/>`,
      )
      parts.push(
        `<text x="${cardLeft + 8}" y="${cardTop + 21}" font-family="${FONT_STACK}" font-size="11" font-weight="500" fill="${theme.foreground}">${escapeXml(
          truncateToWidth(event.title, card.width - 16, 11),
        )}</text>`,
      )
      parts.push(
        `<text x="${cardLeft + 8}" y="${cardTop + 35}" font-family="${FONT_STACK}" font-size="10" fill="${theme.muted}">${escapeXml(
          truncateToWidth(
            `${eventDateLabel(event)} · ${formatEventDuration(event.startDate, event.endDate)}`,
            card.width - 16,
            10,
          ),
        )}</text>`,
      )
    }

    if (index === lanes.length - 1) {
      parts.push(
        `<line x1="${PADDING}" y1="${top + laneHeight}" x2="${width - PADDING}" y2="${top + laneHeight}" stroke="${theme.border}" stroke-width="1"/>`,
      )
    }
  })

  parts.push(
    `<text x="${PADDING}" y="${height - PADDING + 6}" font-family="${FONT_STACK}" font-size="10" fill="${theme.muted}">tlmkr.com</text>`,
  )

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(timeline.title)} timeline">`,
    `<title>${escapeXml(timeline.title)}</title>`,
    ...parts,
    '</svg>',
  ].join('')
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function downloadTimelineSvg(
  timeline: TimelineRecord,
  options: TimelineImageOptions = {},
): void {
  downloadBlob(
    new Blob([createTimelineSvg(timeline, options)], {
      type: 'image/svg+xml;charset=utf-8',
    }),
    `${createExportBasename(timeline.title)}.svg`,
  )
}

export async function downloadTimelinePng(
  timeline: TimelineRecord,
  options: TimelineImageOptions = {},
): Promise<void> {
  const scale = options.scale ?? 2
  const svg = createTimelineSvg(timeline, options)
  const source = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(source)

  try {
    const image = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.width * scale)
    canvas.height = Math.round(image.height * scale)

    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser cannot render the image.')
    context.scale(scale, scale)
    context.drawImage(image, 0, 0)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    )
    if (!blob) throw new Error('The image could not be encoded.')

    downloadBlob(blob, `${createExportBasename(timeline.title)}.png`)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () =>
      reject(new Error('The timeline image could not be rendered.')),
    )
    image.src = url
  })
}

/** Dimensions the SVG will occupy, useful for tests and previews. */
export function measureTimelineSvg(svg: string): {
  width: number
  height: number
} {
  const width = Number(/width="(\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? 0)
  const height = Number(/height="(\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? 0)
  return { width, height }
}
