import { describe, expect, test } from 'bun:test'

import {
  MAXIMUM_STORED_PAYLOAD_LENGTH,
  SHARE_CREATE_PATH,
  SHARE_ID_LENGTH,
  ShareLinkError,
  createShortShareLink,
  fetchSharedPayload,
  generateShareId,
  isShareId,
  isShareablePayload,
  shareReadPath,
  shortLinkPath,
} from './shareLink'
import { encodeTimelineForSharing } from './share'
import { addLayer, createTimeline } from './operations'
import type { TimelineRecord } from './model'

function sampleTimeline(): TimelineRecord {
  const timeline = createTimeline('Shared plan', {
    timelineId: '00000000-0000-4000-8000-000000000010',
    defaultLayerId: '00000000-0000-4000-8000-000000000001',
    now: '2024-01-01T00:00:00.000Z',
  })

  return addLayer(
    timeline,
    { title: 'Second', color: '#16a34a' },
    {
      id: '00000000-0000-4000-8000-000000000002',
      now: '2024-01-01T00:00:00.000Z',
    },
  )
}

/** A `fetch` stand-in that records its call and replies with a fixed response. */
function stubFetch(response: Response | (() => never)) {
  const calls: Array<{ url: string; init?: RequestInit }> = []

  const impl = ((url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (typeof response === 'function') return Promise.reject(new Error('down'))
    return Promise.resolve(response)
  }) as unknown as typeof fetch

  return { impl, calls }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('share ids', () => {
  test('generates ids of the advertised shape', () => {
    for (let index = 0; index < 50; index++) {
      const id = generateShareId()

      expect(id).toHaveLength(SHARE_ID_LENGTH)
      expect(isShareId(id)).toBe(true)
    }
  })

  test('leaves out the characters that misread when retyped', () => {
    const ids = Array.from({ length: 200 }, () => generateShareId()).join('')

    expect(ids).not.toMatch(/[lo01]/)
  })

  test('rejects ids of the wrong shape', () => {
    expect(isShareId('')).toBe(false)
    expect(isShareId('short')).toBe(false)
    expect(isShareId('abcdefghijkl0')).toBe(false)
    expect(isShareId('ABCDEFGHIJKL')).toBe(false)
    expect(isShareId('abcdefghijk!')).toBe(false)
    // Excluded from the alphabet, so a valid length is still not a valid id.
    expect(isShareId('abcdefghijkl'.replace('l', 'o'))).toBe(false)
  })

  test('builds the paths the routes expose', () => {
    expect(shortLinkPath('abcdefghijkm')).toBe('/s/abcdefghijkm')
    expect(shareReadPath('abcdefghijkm')).toBe('/api/share/abcdefghijkm')
    // Creating must not sit at the parent path of reading.
    expect(SHARE_CREATE_PATH.startsWith('/api/share/')).toBe(true)
  })
})

describe('payload validation', () => {
  test('accepts what the encoder produces', async () => {
    const payload = await encodeTimelineForSharing(sampleTimeline())

    expect(isShareablePayload(payload)).toBe(true)
  })

  test('rejects payloads that are not share payloads', () => {
    expect(isShareablePayload('')).toBe(false)
    expect(isShareablePayload('nonsense')).toBe(false)
    expect(isShareablePayload('zz.abcdef')).toBe(false)
    expect(isShareablePayload('g1.')).toBe(false)
    expect(isShareablePayload('g1.not+base64url/')).toBe(false)
  })

  test('rejects a payload past the stored size cap', () => {
    const oversized = `g1.${'a'.repeat(MAXIMUM_STORED_PAYLOAD_LENGTH)}`

    expect(isShareablePayload(oversized)).toBe(false)
  })
})

describe('creating a short link', () => {
  test('posts the payload and returns the link', async () => {
    const expiresAt = '2024-01-02T00:00:00.000Z'
    const { impl, calls } = stubFetch(
      jsonResponse({ id: 'abcdefghijkm', expiresAt }, 201),
    )

    const link = await createShortShareLink(
      sampleTimeline(),
      'https://tlmkr.com/',
      impl,
    )

    expect(link).toEqual({ url: 'https://tlmkr.com/s/abcdefghijkm', expiresAt })
    expect(calls[0].url).toBe(SHARE_CREATE_PATH)
    expect(calls[0].init?.method).toBe('POST')
    expect(isShareablePayload(String(calls[0].init?.body))).toBe(true)
  })

  test('surfaces the server message when the limit is hit', async () => {
    const { impl } = stubFetch(
      jsonResponse({ error: 'Too many links created just now.' }, 429),
    )

    await expect(
      createShortShareLink(sampleTimeline(), 'https://tlmkr.com', impl),
    ).rejects.toThrow('Too many links created just now.')
  })

  test('rejects an id the server should never have sent', async () => {
    const { impl } = stubFetch(jsonResponse({ id: 'nope' }, 201))

    await expect(
      createShortShareLink(sampleTimeline(), 'https://tlmkr.com', impl),
    ).rejects.toThrow(ShareLinkError)
  })

  test('turns a network failure into a readable error', async () => {
    const { impl } = stubFetch(() => {
      throw new Error('down')
    })

    await expect(
      createShortShareLink(sampleTimeline(), 'https://tlmkr.com', impl),
    ).rejects.toThrow(ShareLinkError)
  })
})

describe('reading a short link', () => {
  test('returns the stored payload', async () => {
    const { impl, calls } = stubFetch(jsonResponse({ payload: 'g1.abc' }))

    expect(await fetchSharedPayload('abcdefghijkm', impl)).toBe('g1.abc')
    expect(calls[0].url).toBe('/api/share/abcdefghijkm')
  })

  test('explains an expired link', async () => {
    const { impl } = stubFetch(jsonResponse({ error: 'gone' }, 404))

    await expect(fetchSharedPayload('abcdefghijkm', impl)).rejects.toThrow(
      /expired/i,
    )
  })

  test('does not call the server for a malformed id', async () => {
    const { impl, calls } = stubFetch(jsonResponse({ payload: 'g1.abc' }))

    await expect(fetchSharedPayload('nope', impl)).rejects.toThrow(
      ShareLinkError,
    )
    expect(calls).toHaveLength(0)
  })
})
