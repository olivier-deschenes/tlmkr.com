import { TimelineShareError, encodeTimelineForSharing } from './share'
import type { TimelineRecord } from './model'

/**
 * Short share links trade the fragment link's privacy for a pasteable URL.
 *
 * A fragment link (see `share.ts`) never leaves the browser but carries the
 * whole timeline, so it runs to thousands of characters and chat clients
 * truncate it. A short link stores the same payload in Cloudflare KV under a
 * random id and hands out `/s/<id>` instead. The timeline does leave the
 * browser, which is why this is a second, explicit choice rather than the
 * default.
 */

/** Stored shares expire a day after they are created. */
export const SHORT_LINK_TTL_SECONDS = 86_400

/**
 * Lowercase and digits, minus the characters that misread when a link is
 * spoken or retyped (`l`/`1`, `o`/`0`).
 */
const SHARE_ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

/** 32^12 ids against a store that empties daily: guessing one is hopeless. */
export const SHARE_ID_LENGTH = 12

const shareIdPattern = new RegExp(
  `^[${SHARE_ID_ALPHABET}]{${SHARE_ID_LENGTH}}$`,
)

/**
 * Generous next to a realistic timeline, small enough that the endpoint is
 * useless as free file storage.
 */
export const MAXIMUM_STORED_PAYLOAD_LENGTH = 512 * 1024

/** Payloads are the `<codec>.<base64url>` strings that `share.ts` produces. */
const payloadPattern = /^(?:g1|p1)\.[A-Za-z0-9_-]+$/

export class ShareLinkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShareLinkError'
  }
}

/** Ids come from the server, so a client can never pick one and overwrite it. */
export function generateShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SHARE_ID_LENGTH))
  let id = ''
  for (const byte of bytes) {
    id += SHARE_ID_ALPHABET[byte % SHARE_ID_ALPHABET.length]
  }
  return id
}

export function isShareId(value: string): boolean {
  return shareIdPattern.test(value)
}

export function isShareablePayload(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAXIMUM_STORED_PAYLOAD_LENGTH &&
    payloadPattern.test(value)
  )
}

export function shortLinkPath(shareId: string): string {
  return `/s/${shareId}`
}

/**
 * Creating and reading live on sibling paths on purpose: with flat file routes
 * a `/api/share` route file would become the parent layout of
 * `/api/share/$shareId`, and its handlers would sit in front of every read.
 */
export const SHARE_CREATE_PATH = '/api/share/new'

export function shareReadPath(shareId: string): string {
  return `/api/share/${shareId}`
}

export interface ShortShareLink {
  url: string
  /** ISO timestamp at which the stored copy disappears. */
  expiresAt: string
}

interface CreateShareResponse {
  id?: unknown
  expiresAt?: unknown
  error?: unknown
}

function errorMessage(body: CreateShareResponse, fallback: string): string {
  return typeof body.error === 'string' && body.error ? body.error : fallback
}

async function readJson(response: Response): Promise<CreateShareResponse> {
  try {
    return (await response.json()) as CreateShareResponse
  } catch {
    return {}
  }
}

/** Uploads the timeline and returns the short link that now points at it. */
export async function createShortShareLink(
  timeline: TimelineRecord,
  origin: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ShortShareLink> {
  const payload = await encodeTimelineForSharing(timeline)

  if (payload.length > MAXIMUM_STORED_PAYLOAD_LENGTH) {
    throw new ShareLinkError(
      'This timeline is too large to share. Export it as JSON and send the file instead.',
    )
  }

  let response: Response
  try {
    response = await fetchImpl(SHARE_CREATE_PATH, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: payload,
    })
  } catch {
    throw new ShareLinkError(
      'The short link could not be created. Check your connection and try again.',
    )
  }

  const body = await readJson(response)

  if (response.status === 429) {
    throw new ShareLinkError(
      errorMessage(body, 'Too many links created just now. Try again shortly.'),
    )
  }

  if (!response.ok || typeof body.id !== 'string' || !isShareId(body.id)) {
    throw new ShareLinkError(
      errorMessage(body, 'The short link could not be created.'),
    )
  }

  return {
    url: `${origin.replace(/\/+$/, '')}${shortLinkPath(body.id)}`,
    expiresAt:
      typeof body.expiresAt === 'string'
        ? body.expiresAt
        : new Date(Date.now() + SHORT_LINK_TTL_SECONDS * 1000).toISOString(),
  }
}

/** Fetches the stored payload behind a short link, ready for decoding. */
export async function fetchSharedPayload(
  shareId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (!isShareId(shareId)) {
    throw new ShareLinkError('This share link is not in a known format.')
  }

  let response: Response
  try {
    response = await fetchImpl(shareReadPath(shareId))
  } catch {
    throw new ShareLinkError(
      'This shared timeline could not be loaded. Check your connection and try again.',
    )
  }

  if (response.status === 404 || response.status === 410) {
    throw new ShareLinkError(
      'This share link has expired. Short links stop working one day after they are created.',
    )
  }

  const body = (await readJson(response)) as { payload?: unknown }

  if (!response.ok || typeof body.payload !== 'string') {
    throw new ShareLinkError(
      errorMessage(
        body as CreateShareResponse,
        'This shared timeline could not be loaded.',
      ),
    )
  }

  return body.payload
}

/**
 * Re-exported so callers can catch one error type for either share flavour.
 */
export { TimelineShareError }
