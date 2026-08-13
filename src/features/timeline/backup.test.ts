import { describe, expect, test } from 'bun:test'

import {
  BACKUP_REMINDER_DAYS,
  evaluateBackup,
  forgetBackup,
  readBackupLog,
  recordBackup,
  writeBackupLog,
} from './backup'
import { addEvent, createTimeline } from './operations'
import type { TimelineRecord } from './model'

const DAY = 86_400_000
const NOW = new Date('2024-06-01T12:00:00.000Z')

function timelineWithEvent(
  createdAt: string,
  updatedAt: string,
): TimelineRecord {
  const timeline = addEvent(
    createTimeline('Backup', {
      timelineId: '00000000-0000-4000-8000-000000000010',
      defaultLayerId: '00000000-0000-4000-8000-000000000001',
      now: createdAt,
    }),
    {
      title: 'Something',
      layerId: '00000000-0000-4000-8000-000000000001',
      color: '#2563eb',
      startDate: '2024-01-01',
    },
    { id: '00000000-0000-4000-8000-000000000100', now: updatedAt },
  )

  return { ...timeline, updatedAt }
}

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY).toISOString()
}

class MemoryStorage implements Storage {
  private readonly entries = new Map<string, string>()
  get length() {
    return this.entries.size
  }
  clear() {
    this.entries.clear()
  }
  getItem(key: string) {
    return this.entries.get(key) ?? null
  }
  key(index: number) {
    return [...this.entries.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.entries.delete(key)
  }
  setItem(key: string, value: string) {
    this.entries.set(key, value)
  }
}

describe('backup reminders', () => {
  test('stays quiet for a timeline with no events', () => {
    const empty = createTimeline('Empty', { now: daysAgo(400) })

    expect(evaluateBackup(empty, {}, NOW).shouldRemind).toBe(false)
  })

  test('stays quiet for a young timeline that was never exported', () => {
    const timeline = timelineWithEvent(daysAgo(2), daysAgo(1))

    expect(evaluateBackup(timeline, {}, NOW).shouldRemind).toBe(false)
  })

  test('reminds once an unexported timeline has been around a while', () => {
    const timeline = timelineWithEvent(
      daysAgo(BACKUP_REMINDER_DAYS + 1),
      daysAgo(1),
    )
    const status = evaluateBackup(timeline, {}, NOW)

    expect(status.shouldRemind).toBe(true)
    expect(status.daysSinceExport).toBeNull()
    expect(status.message).toContain('never been exported')
  })

  test('stays quiet when the export is newer than the last edit', () => {
    const timeline = timelineWithEvent(daysAgo(400), daysAgo(60))
    const log = { [timeline.id]: daysAgo(30) }

    expect(evaluateBackup(timeline, log, NOW).shouldRemind).toBe(false)
  })

  test('stays quiet when an old export is followed by no edits', () => {
    const timeline = timelineWithEvent(daysAgo(400), daysAgo(200))
    const log = { [timeline.id]: daysAgo(100) }

    expect(evaluateBackup(timeline, log, NOW).shouldRemind).toBe(false)
  })

  test('reminds when edits have piled up since a stale export', () => {
    const timeline = timelineWithEvent(daysAgo(400), daysAgo(1))
    const log = { [timeline.id]: daysAgo(BACKUP_REMINDER_DAYS + 5) }
    const status = evaluateBackup(timeline, log, NOW)

    expect(status.shouldRemind).toBe(true)
    expect(status.daysSinceExport).toBe(BACKUP_REMINDER_DAYS + 5)
  })

  test('stays quiet when a recent export predates a recent edit', () => {
    const timeline = timelineWithEvent(daysAgo(400), daysAgo(1))
    const log = { [timeline.id]: daysAgo(2) }

    expect(evaluateBackup(timeline, log, NOW).shouldRemind).toBe(false)
  })
})

describe('backup log storage', () => {
  test('round-trips through storage', () => {
    const storage = new MemoryStorage()
    const log = recordBackup({}, 'timeline-a', NOW)
    writeBackupLog(storage, log)

    expect(readBackupLog(storage)).toEqual({
      'timeline-a': NOW.toISOString(),
    })
  })

  test('forgets a deleted timeline', () => {
    const log = recordBackup(recordBackup({}, 'a', NOW), 'b', NOW)

    expect(Object.keys(forgetBackup(log, 'a'))).toEqual(['b'])
  })

  test('treats damaged storage as empty rather than failing', () => {
    const storage = new MemoryStorage()
    storage.setItem('tlmkr.backups.v1', 'not json')
    expect(readBackupLog(storage)).toEqual({})

    storage.setItem('tlmkr.backups.v1', '["an","array"]')
    expect(readBackupLog(storage)).toEqual({})

    storage.setItem(
      'tlmkr.backups.v1',
      '{"a":1,"b":"2024-01-01T00:00:00.000Z"}',
    )
    expect(readBackupLog(storage)).toEqual({ b: '2024-01-01T00:00:00.000Z' })
  })

  test('survives storage being unavailable', () => {
    expect(readBackupLog(undefined)).toEqual({})
    expect(() => writeBackupLog(undefined, {})).not.toThrow()
  })
})
