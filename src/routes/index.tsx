import { useCallback, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { toast } from 'sonner'

import { TimelineApp } from '#/features/timeline/TimelineApp'
import {
  decodeSharedTimeline,
  readShareFragment,
} from '#/features/timeline/share'
import type { TimelineRecord } from '#/features/timeline/model'

const timelineSearchSchema = z.object({
  timeline: z.string().uuid().optional().catch(undefined),
})

export const Route = createFileRoute('/')({
  ssr: false,
  validateSearch: timelineSearchSchema,
  component: Home,
})

function Home() {
  const { timeline } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [sharedTimeline, setSharedTimeline] = useState<TimelineRecord>()

  const onSelectTimeline = useCallback(
    (timelineId: string | undefined, replace = false) => {
      void navigate({
        search: timelineId ? { timeline: timelineId } : {},
        replace,
      })
    },
    [navigate],
  )

  // A share link carries its timeline in the fragment, so decoding it is a
  // client-only concern that never reaches the router's search params.
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
      activeTimelineId={timeline}
      onSelectTimeline={onSelectTimeline}
      sharedTimeline={sharedTimeline}
      onDismissShared={dismissShared}
    />
  )
}
