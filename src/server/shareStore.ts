import { env } from 'cloudflare:workers'

import {
  MAXIMUM_STORED_PAYLOAD_LENGTH,
  SHORT_LINK_TTL_SECONDS,
  generateShareId,
  isShareId,
  isShareablePayload,
} from '#/features/timeline/shareLink'
import { decodeSharedTimeline } from '#/features/timeline/share'

/**
 * The only server-side state this app has: share payloads, keyed by a random
 * id, each one deleted by Cloudflare a day after it is written.
 *
 * Keys are freshly generated and never overwritten, so KV's eventual
 * consistency does not apply — a brand new key has no stale copy to serve.
 */

const KEY_PREFIX = 'share:'

interface ShareMetadata {
  createdAt: string
}

export interface StoredShare {
  payload: string
  expiresAt: string
}

export class ShareStoreError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ShareStoreError'
    this.status = status
  }
}

function expiresAtFrom(createdAt: string): string {
  const created = Date.parse(createdAt)
  const base = Number.isNaN(created) ? Date.now() : created
  return new Date(base + SHORT_LINK_TTL_SECONDS * 1000).toISOString()
}

/**
 * Rejects the request when one address has minted too many links recently.
 * A missing binding (older local runtimes) is treated as "allowed" rather than
 * failing every share.
 */
export async function assertWithinRateLimit(request: Request): Promise<void> {
  const limiter = env.SHARE_RATE_LIMIT
  if (!limiter) return

  const address = request.headers.get('cf-connecting-ip') ?? 'unknown'
  const { success } = await limiter.limit({ key: address })

  if (!success) {
    throw new ShareStoreError(
      429,
      'Too many links created just now. Try again in a minute.',
    )
  }
}

/**
 * Stores a payload and returns the id it now lives under.
 *
 * The payload is decoded before it is written: it has to be a timeline this app
 * can open, which keeps the endpoint from doubling as anonymous file storage.
 */
export async function putShare(
  payload: string,
): Promise<StoredShare & { id: string }> {
  if (payload.length > MAXIMUM_STORED_PAYLOAD_LENGTH) {
    throw new ShareStoreError(
      413,
      'This timeline is too large to share. Export it as JSON and send the file instead.',
    )
  }

  if (!isShareablePayload(payload)) {
    throw new ShareStoreError(400, 'This is not a shareable timeline payload.')
  }

  try {
    await decodeSharedTimeline(payload)
  } catch {
    throw new ShareStoreError(400, 'This is not a shareable timeline payload.')
  }

  const id = generateShareId()
  const createdAt = new Date().toISOString()

  await env.SHARE_LINKS.put(`${KEY_PREFIX}${id}`, payload, {
    expirationTtl: SHORT_LINK_TTL_SECONDS,
    metadata: { createdAt } satisfies ShareMetadata,
  })

  return { id, payload, expiresAt: expiresAtFrom(createdAt) }
}

/** Reads a stored share, or throws a 404 when it has expired or never existed. */
export async function getShare(shareId: string): Promise<StoredShare> {
  if (!isShareId(shareId)) {
    throw new ShareStoreError(404, 'This share link is not in a known format.')
  }

  const { value, metadata } =
    await env.SHARE_LINKS.getWithMetadata<ShareMetadata>(
      `${KEY_PREFIX}${shareId}`,
    )

  if (value === null) {
    throw new ShareStoreError(
      404,
      'This share link has expired. Short links stop working one day after they are created.',
    )
  }

  return {
    payload: value,
    expiresAt: expiresAtFrom(metadata?.createdAt ?? new Date().toISOString()),
  }
}
