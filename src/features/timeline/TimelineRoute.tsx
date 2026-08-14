import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { TimelineApp } from '#/features/timeline/TimelineApp'
import {
  decodeSharedTimeline,
  readShareFragment,
} from '#/features/timeline/share'
import { fetchSharedPayload } from '#/features/timeline/shareLink'
import type { TimelineRecord } from '#/features/timeline/model'

interface TimelineRouteProps {
  /** Taken from the path: `/` is the home screen, `/<id>` opens a timeline. */
  timelineId?: string
  /** Taken from `/s/<id>`: a short link whose timeline is fetched on mount. */
  shareId?: string
  /** Taken from `?template=<id>`: opens that starter instead of the home screen. */
  templateId?: string
}

export function TimelineRoute({
  timelineId,
  shareId,
  templateId,
}: TimelineRouteProps) {
  const navigate = useNavigate()
  const [sharedTimeline, setSharedTimeline] = useState<TimelineRecord>()

  const onSelectTimeline = useCallback(
    (nextTimelineId: string | undefined, replace = false) => {
      void (nextTimelineId
        ? navigate({
            to: '/$timelineId',
            params: { timelineId: nextTimelineId },
            replace,
          })
        : navigate({ to: '/', replace }))
    },
    [navigate],
  )

  // A short link carries an id to fetch. The fragment branch is only for links
  // shared before short links existed, which carry the timeline in the URL
  // itself; nothing produces those any more. Either way the result is a
  // read-only timeline that was never written to this browser.
  useEffect(() => {
    const fragment = shareId ? null : readShareFragment(window.location.hash)
    if (!shareId && !fragment) return

    let cancelled = false

    const load = async () => {
      const payload = shareId ? await fetchSharedPayload(shareId) : fragment!
      return decodeSharedTimeline(payload)
    }

    void load()
      .then((record) => {
        if (!cancelled) setSharedTimeline(record)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        toast.error(
          error instanceof Error
            ? error.message
            : 'That share link could not be opened.',
        )
        if (shareId) void navigate({ to: '/', replace: true })
        else window.history.replaceState(null, '', window.location.pathname)
      })

    return () => {
      cancelled = true
    }
  }, [navigate, shareId])

  const dismissShared = useCallback(() => {
    setSharedTimeline(undefined)

    // A short link lives at its own path, so leaving it means navigating away;
    // a fragment link only needs the hash stripped.
    if (shareId) {
      void navigate({ to: '/', replace: true })
      return
    }

    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}`,
    )
  }, [navigate, shareId])

  return (
    <TimelineApp
      activeTimelineId={timelineId}
      onSelectTimeline={onSelectTimeline}
      sharedTimeline={sharedTimeline}
      onDismissShared={dismissShared}
      initialTemplateId={templateId}
    />
  )
}
