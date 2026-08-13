import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'

import { TimelineRoute } from '#/features/timeline/TimelineRoute'

const timelineIdSchema = z.uuid()

export const Route = createFileRoute('/$timelineId')({
  ssr: false,
  // Only a timeline id can sit at the root, so anything else is a 404 rather
  // than a silent fall back to the home screen.
  beforeLoad: ({ params }) => {
    if (!timelineIdSchema.safeParse(params.timelineId).success) throw notFound()
  },
  component: Timeline,
})

function Timeline() {
  const { timelineId } = Route.useParams()

  return <TimelineRoute timelineId={timelineId} />
}
