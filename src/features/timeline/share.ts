import { parseTimelineImport } from './timelineImport'
import type { TimelineRecord } from './model'

/**
 * Packs a timeline into the compact payload a share link carries.
 *
 * Sharing goes through `shareLink.ts`, which stores this payload and hands out
 * a short URL. The payload is gzipped before base64 because it used to have to
 * fit in a URL, and staying small still keeps the stored copy cheap.
 */

/** Only read now, to keep links shared before short links existed working. */
export const SHARE_FRAGMENT_KEY = 'timeline'

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

/**
 * Pulls the share payload out of a location hash, if there is one.
 *
 * Nothing produces these links any more; this reads the ones already out there.
 */
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
