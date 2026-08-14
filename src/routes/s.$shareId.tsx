import { createFileRoute, notFound } from '@tanstack/react-router'

import { TimelineRoute } from '#/features/timeline/TimelineRoute'
import { isShareId } from '#/features/timeline/shareLink'

export const Route = createFileRoute('/s/$shareId')({
  ssr: false,
  // A malformed id can never match a stored share, so it is a 404 rather than a
  // request that goes out and comes back empty.
  beforeLoad: ({ params }) => {
    if (!isShareId(params.shareId)) throw notFound()
  },
  component: SharedTimeline,
})

function SharedTimeline() {
  const { shareId } = Route.useParams()

  return <TimelineRoute shareId={shareId} />
}
