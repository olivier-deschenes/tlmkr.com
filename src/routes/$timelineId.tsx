import { ClientOnly, createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'

import { TimelineLoading } from '#/features/timeline/TimelineLoading'
import { TimelineRoute } from '#/features/timeline/TimelineRoute'
import { noindexMeta } from '#/lib/seo'

const timelineIdSchema = z.uuid()

export const Route = createFileRoute('/$timelineId')({
  // Only a timeline id can sit at the root, so anything else is a 404 rather
  // than a silent fall back to the home screen.
  //
  // This runs on the server, which is the point: when the route skipped server
  // rendering entirely the rejection below never reached the response, and a
  // mistyped URL came back 200 with an empty body — a soft 404, which search
  // engines treat as a page worth revisiting rather than one that is gone.
  beforeLoad: ({ params }) => {
    if (!timelineIdSchema.safeParse(params.timelineId).success) throw notFound()
  },
  // A timeline id names a record in one person's browser, so this path renders
  // an empty editor for everyone else. Left indexable it would offer a crawler
  // an unbounded space of UUIDs that all look like the same blank page.
  head: () => ({ meta: noindexMeta }),
  component: Timeline,
})

function Timeline() {
  const { timelineId } = Route.useParams()

  return (
    <ClientOnly fallback={<TimelineLoading />}>
      <TimelineRoute timelineId={timelineId} />
    </ClientOnly>
  )
}
