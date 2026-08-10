import { useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { TimelineApp } from '#/features/timeline/TimelineApp'

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
  const onSelectTimeline = useCallback(
    (timelineId: string | undefined, replace = false) => {
      void navigate({
        search: timelineId ? { timeline: timelineId } : {},
        replace,
      })
    },
    [navigate],
  )

  return (
    <TimelineApp
      activeTimelineId={timeline}
      onSelectTimeline={onSelectTimeline}
    />
  )
}
