import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { TimelineApp } from '#/features/timeline/TimelineApp'
import {
  decodeSharedTimeline,
  readShareFragment,
} from '#/features/timeline/share'
import type { TimelineRecord } from '#/features/timeline/model'

interface TimelineRouteProps {
  /** Taken from the path: `/` is the home screen, `/<id>` opens a timeline. */
  timelineId?: string
}

export function TimelineRoute({ timelineId }: TimelineRouteProps) {
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

  // A share link carries its timeline in the fragment, so decoding it is a
  // client-only concern that never reaches the router.
  useEffect(() => {
    const payload = readShareFragment(window.location.hash)
    if (!payload) return

    let cancelled = false
    void decodeSharedTimeline(payload)
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
        window.history.replaceState(null, '', window.location.pathname)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const dismissShared = useCallback(() => {
    setSharedTimeline(undefined)
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}`,
    )
  }, [])

  return (
    <TimelineApp
      activeTimelineId={timelineId}
      onSelectTimeline={onSelectTimeline}
      sharedTimeline={sharedTimeline}
      onDismissShared={dismissShared}
    />
  )
}
