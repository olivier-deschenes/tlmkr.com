import {
  createCollection,
  localStorageCollectionOptions,
} from '@tanstack/react-db'
import type { StorageApi, StorageEventApi } from '@tanstack/react-db'

import { timelineRecordSchema } from './model'
import type { TimelineRecord } from './model'

export const TIMELINE_COLLECTION_ID = 'timeline-maker:timelines'
export const TIMELINE_STORAGE_KEY = 'timeline-maker.timelines.v1'

export interface TimelineCollectionOptions {
  /** Override the collection id when constructing an isolated test collection. */
  collectionId?: string
  /** Override the versioned production key when constructing an isolated test collection. */
  storageKey?: string
  /** Supply a Storage-compatible implementation for tests or alternate browser storage. */
  storage?: StorageApi
  /** Supply the storage event source used for cross-context synchronization. */
  storageEventApi?: StorageEventApi
}

/**
 * Builds a collection whose rows are complete timeline aggregates.
 *
 * Application code should normally use `getTimelineCollection` so importing this
 * module during server rendering never captures the adapter's in-memory fallback.
 */
export function createTimelineCollection(
  options: TimelineCollectionOptions = {},
) {
  return createCollection(
    localStorageCollectionOptions({
      id: options.collectionId ?? TIMELINE_COLLECTION_ID,
      storageKey: options.storageKey ?? TIMELINE_STORAGE_KEY,
      storage: options.storage,
      storageEventApi: options.storageEventApi,
      schema: timelineRecordSchema,
      getKey: (timeline: TimelineRecord) => timeline.id,
    }),
  )
}

export type TimelineCollection = ReturnType<typeof createTimelineCollection>

let browserTimelineCollection: TimelineCollection | undefined

/**
 * Returns the browser collection singleton for use as a `useLiveQuery` source.
 * The collection is deliberately created on first client access, not at module
 * evaluation time, so TanStack Start's server import cannot bind it to memory.
 */
export function getTimelineCollection(): TimelineCollection {
  if (typeof window === 'undefined') {
    throw new Error(
      'The timeline collection is browser-only. Call getTimelineCollection() from a client component.',
    )
  }

  browserTimelineCollection ??= createTimelineCollection()
  return browserTimelineCollection
}

/** Alias with a plural noun for call sites that treat the collection as a list. */
export const getTimelinesCollection = getTimelineCollection

/** Clears only the module singleton; intended for isolated browser tests. */
export function resetTimelineCollectionForTests(): void {
  browserTimelineCollection = undefined
}
