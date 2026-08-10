import { afterEach, describe, expect, test } from 'bun:test'
import type { StorageApi, StorageEventApi } from '@tanstack/react-db'

import type { TimelineRecord } from './model'
import { createTimelineCollection } from './storage'
import type { TimelineCollection } from './storage'

interface SharedStorageEnvironment {
  storage: StorageApi
  storageEventApi: StorageEventApi
}

function createSharedStorageEnvironment(): SharedStorageEnvironment {
  const data = new Map<string, string>()
  const listeners = new Set<(event: StorageEvent) => void>()

  const storage: StorageApi = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)

      const event = { key, storageArea: storage } as unknown as StorageEvent
      listeners.forEach((listener) => listener(event))
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }

  const storageEventApi: StorageEventApi = {
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
  }

  return { storage, storageEventApi }
}

function makeTimeline(
  id: string,
  layerId: string,
  title: string,
): TimelineRecord {
  return {
    schemaVersion: 1,
    id,
    title,
    createdAt: '2026-08-10T12:00:00.000Z',
    updatedAt: '2026-08-10T12:00:00.000Z',
    layers: [
      {
        id: layerId,
        title: 'Default layer',
        color: '#64748b',
        order: 0,
      },
    ],
    events: [],
  }
}

const collections: Array<TimelineCollection> = []

function makeCollection(
  environment: SharedStorageEnvironment,
  collectionId: string,
) {
  const collection = createTimelineCollection({
    collectionId,
    storageKey: 'timeline-storage-test.v1',
    ...environment,
  })
  collections.push(collection)
  return collection
}

afterEach(async () => {
  await Promise.all(
    collections.splice(0).map((collection) => collection.cleanup()),
  )
})

describe('timeline local storage collection', () => {
  test('persists and reloads multiple timeline aggregates', async () => {
    const environment = createSharedStorageEnvironment()
    const writer = makeCollection(environment, 'timeline-writer')
    await writer.preload()

    const first = makeTimeline(
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000011',
      'Product history',
    )
    const second = makeTimeline(
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000012',
      'Company history',
    )

    await writer.insert([first, second]).isPersisted.promise

    const reloaded = makeCollection(environment, 'timeline-reloaded')
    await reloaded.preload()

    expect(reloaded.size).toBe(2)
    expect(reloaded.get(first.id)?.title).toBe('Product history')
    expect(reloaded.get(second.id)?.title).toBe('Company history')
  })

  test('synchronizes timeline changes through storage events', async () => {
    const environment = createSharedStorageEnvironment()
    const firstTab = makeCollection(environment, 'timeline-first-tab')
    const secondTab = makeCollection(environment, 'timeline-second-tab')
    await Promise.all([firstTab.preload(), secondTab.preload()])

    const timeline = makeTimeline(
      '00000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000013',
      'Original title',
    )
    await firstTab.insert(timeline).isPersisted.promise

    expect(secondTab.get(timeline.id)?.title).toBe('Original title')

    await firstTab.update(timeline.id, (draft) => {
      draft.title = 'Updated title'
      draft.updatedAt = '2026-08-10T13:00:00.000Z'
    }).isPersisted.promise

    expect(secondTab.get(timeline.id)?.title).toBe('Updated title')

    await firstTab.delete(timeline.id).isPersisted.promise
    expect(secondTab.has(timeline.id)).toBe(false)
  })
})
