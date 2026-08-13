import { parseTimelineImport } from './timelineImport'
import type { TimelineRecord } from './model'

/**
 * Share links carry the whole timeline in the URL fragment.
 *
 * A fragment is never sent to the server by the browser, so a shared timeline
 * stays as private as a local one: there is no upload, no database row, and no
 * link that keeps working after the recipient closes the tab. The cost is that
 * the timeline has to fit in a URL, hence gzip before base64.
 */
export const SHARE_FRAGMENT_KEY = 'timeline'

/** Past this, browsers and chat clients start truncating pasted links. */
export const MAXIMUM_SHARE_LENGTH = 30_000

const GZIP_PREFIX = 'g1'
const PLAIN_PREFIX = 'p1'

export class TimelineShareError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimelineShareError'
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function collect(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  const buffer = await new Response(stream).arrayBuffer()
  return new Uint8Array(buffer)
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null

  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('gzip'))
  return collect(stream)
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new TimelineShareError(
      'This browser cannot read compressed share links.',
    )
  }

  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
  return collect(stream)
}

/** Encodes a timeline into the opaque payload half of a share link. */
export async function encodeTimelineForSharing(
  timeline: TimelineRecord,
): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(timeline))
  const compressed = await gzip(json)

  return compressed
    ? `${GZIP_PREFIX}.${toBase64Url(compressed)}`
    : `${PLAIN_PREFIX}.${toBase64Url(json)}`
}

export async function decodeSharedTimeline(
  payload: string,
): Promise<TimelineRecord> {
  const separator = payload.indexOf('.')
  const prefix = separator > 0 ? payload.slice(0, separator) : ''
  const body = separator > 0 ? payload.slice(separator + 1) : ''

  if (prefix !== GZIP_PREFIX && prefix !== PLAIN_PREFIX) {
    throw new TimelineShareError('This share link is not in a known format.')
  }

  let json: string
  try {
    const bytes = fromBase64Url(body)
    const decoded = prefix === GZIP_PREFIX ? await gunzip(bytes) : bytes
    json = new TextDecoder().decode(decoded)
  } catch (error) {
    if (error instanceof TimelineShareError) throw error
    throw new TimelineShareError('This share link is damaged or incomplete.')
  }

  return parseTimelineImport(json)
}

export async function createShareUrl(
  timeline: TimelineRecord,
  origin: string,
): Promise<string> {
  const payload = await encodeTimelineForSharing(timeline)
  const url = `${origin.replace(/\/+$/, '')}/#${SHARE_FRAGMENT_KEY}=${payload}`

  if (url.length > MAXIMUM_SHARE_LENGTH) {
    throw new TimelineShareError(
      'This timeline is too large to fit in a link. Export it as JSON and send the file instead.',
    )
  }

  return url
}

/** Pulls the share payload out of a location hash, if there is one. */
export function readShareFragment(hash: string): string | null {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  if (!fragment) return null

  for (const part of fragment.split('&')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    if (part.slice(0, separator) === SHARE_FRAGMENT_KEY) {
      return part.slice(separator + 1) || null
    }
  }

  return null
}
