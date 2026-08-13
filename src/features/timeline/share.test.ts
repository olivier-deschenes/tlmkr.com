import { describe, expect, test } from 'bun:test'

import {
  MAXIMUM_SHARE_LENGTH,
  TimelineShareError,
  createShareUrl,
  decodeSharedTimeline,
  encodeTimelineForSharing,
  readShareFragment,
} from './share'
import { addEvent, addLayer, createTimeline } from './operations'
import type { TimelineRecord } from './model'

function sampleTimeline(eventCount = 3): TimelineRecord {
  let timeline = createTimeline('Shared plan', {
    timelineId: '00000000-0000-4000-8000-000000000010',
    defaultLayerId: '00000000-0000-4000-8000-000000000001',
    now: '2024-01-01T00:00:00.000Z',
  })
  timeline = addLayer(
    timeline,
    { title: 'Second', color: '#16a34a' },
    {
      id: '00000000-0000-4000-8000-000000000002',
      now: '2024-01-01T00:00:00.000Z',
    },
  )

  for (let index = 0; index < eventCount; index++) {
    timeline = addEvent(
      timeline,
      {
        title: `Event ${index}`,
        layerId: timeline.layers[0].id,
        color: '#2563eb',
        startDate: new Date(Date.UTC(2024, 0, 1 + index * 5))
          .toISOString()
          .slice(0, 10),
      },
      {
        id: `00000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
        now: '2024-01-01T00:00:00.000Z',
      },
    )
  }

  return timeline
}

describe('share encoding', () => {
  test('round-trips a timeline exactly', async () => {
    const timeline = sampleTimeline()
    const payload = await encodeTimelineForSharing(timeline)

    expect(await decodeSharedTimeline(payload)).toEqual(timeline)
  })

  test('survives titles with non-ASCII characters', async () => {
    const timeline = {
      ...sampleTimeline(1),
      title: 'Chronologie — été 2024 ✨',
    }
    const payload = await encodeTimelineForSharing(timeline)

    expect((await decodeSharedTimeline(payload)).title).toBe(timeline.title)
  })

  test('produces a URL-safe payload', async () => {
    const payload = await encodeTimelineForSharing(sampleTimeline(20))

    expect(payload).not.toMatch(/[+/=]/)
  })

  test('tags the payload with the codec that produced it', async () => {
    const payload = await encodeTimelineForSharing(sampleTimeline(20))
    const expectedPrefix =
      typeof CompressionStream === 'undefined' ? 'p1.' : 'g1.'

    expect(payload.startsWith(expectedPrefix)).toBe(true)
  })

  test('a realistic timeline fits in a link', async () => {
    const url = await createShareUrl(sampleTimeline(40), 'https://tlmkr.com')

    expect(url.length).toBeLessThan(MAXIMUM_SHARE_LENGTH)
    expect(url).toContain('/#timeline=')
  })

  test('refuses a timeline that would not survive being pasted', async () => {
    await expect(
      createShareUrl(sampleTimeline(500), 'https://tlmkr.com'),
    ).rejects.toThrow(TimelineShareError)
  })

  // Bun has no CompressionStream, so the uncompressed path is what runs here;
  // this pins the behaviour of whichever path the host provides.
  test.skipIf(typeof CompressionStream === 'undefined')(
    'compression shrinks the payload below the raw JSON',
    async () => {
      const timeline = sampleTimeline(40)
      const payload = await encodeTimelineForSharing(timeline)

      expect(payload.length).toBeLessThan(JSON.stringify(timeline).length)
    },
  )

  test('rejects an unknown payload format', async () => {
    await expect(decodeSharedTimeline('zz.abcdef')).rejects.toThrow(
      TimelineShareError,
    )
    await expect(decodeSharedTimeline('nonsense')).rejects.toThrow(
      TimelineShareError,
    )
  })

  test('rejects a damaged payload', async () => {
    const payload = await encodeTimelineForSharing(sampleTimeline(1))
    const damaged = `${payload.slice(0, -12)}AAAAAAAAAAAA`

    await expect(decodeSharedTimeline(damaged)).rejects.toThrow()
  })
})

describe('share fragment parsing', () => {
  test('reads the payload out of a hash', () => {
    expect(readShareFragment('#timeline=g1.abc')).toBe('g1.abc')
    expect(readShareFragment('timeline=g1.abc')).toBe('g1.abc')
    expect(readShareFragment('#other=1&timeline=g1.abc')).toBe('g1.abc')
  })

  test('returns null when there is nothing to read', () => {
    expect(readShareFragment('')).toBeNull()
    expect(readShareFragment('#')).toBeNull()
    expect(readShareFragment('#other=1')).toBeNull()
    expect(readShareFragment('#timeline=')).toBeNull()
  })
})
