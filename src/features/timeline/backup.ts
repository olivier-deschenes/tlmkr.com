import type { TimelineRecord } from './model'

/**
 * Everything this app knows lives in this browser's local storage, which the
 * browser is free to evict — Safari clears it after seven days without a visit,
 * and "clear browsing data" takes it with no warning. A no-account tool cannot
 * recover from that, so the least it can do is notice when a timeline has drifted
 * far from its last export and say so.
 */
export const BACKUP_STORAGE_KEY = 'tlmkr.backups.v1'

/** How long an unexported change may sit before the nudge appears. */
export const BACKUP_REMINDER_DAYS = 14

const DAY_IN_MS = 86_400_000

export type BackupLog = Record<string, string>

export interface BackupStatus {
  shouldRemind: boolean
  /** Whole days since the last export, or null if it was never exported. */
  daysSinceExport: number | null
  message: string
}

export function readBackupLog(storage: Storage | undefined): BackupLog {
  if (!storage) return {}

  try {
    const raw = storage.getItem(BACKUP_STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {}

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    )
  } catch {
    return {}
  }
}

export function writeBackupLog(
  storage: Storage | undefined,
  log: BackupLog,
): void {
  try {
    storage?.setItem(BACKUP_STORAGE_KEY, JSON.stringify(log))
  } catch {
    // A full or blocked storage only costs the reminder, never an edit.
  }
}

export function recordBackup(
  log: BackupLog,
  timelineId: string,
  now: Date = new Date(),
): BackupLog {
  return { ...log, [timelineId]: now.toISOString() }
}

export function forgetBackup(log: BackupLog, timelineId: string): BackupLog {
  const { [timelineId]: _removed, ...rest } = log
  return rest
}

export function evaluateBackup(
  timeline: TimelineRecord,
  log: BackupLog,
  now: Date = new Date(),
): BackupStatus {
  const exportedAt = log[timeline.id]
  const hasContent = timeline.events.length > 0

  if (!exportedAt) {
    const ageDays = Math.floor(
      (now.getTime() - Date.parse(timeline.createdAt)) / DAY_IN_MS,
    )
    return {
      shouldRemind: hasContent && ageDays >= BACKUP_REMINDER_DAYS,
      daysSinceExport: null,
      message:
        'This timeline has never been exported. It only exists in this browser.',
    }
  }

  const exportedMs = Date.parse(exportedAt)
  const daysSinceExport = Math.floor((now.getTime() - exportedMs) / DAY_IN_MS)
  const changedSinceExport = Date.parse(timeline.updatedAt) > exportedMs

  return {
    shouldRemind:
      hasContent &&
      changedSinceExport &&
      daysSinceExport >= BACKUP_REMINDER_DAYS,
    daysSinceExport,
    message: `You last exported this timeline ${daysSinceExport} days ago and have edited it since.`,
  }
}
