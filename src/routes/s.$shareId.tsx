import { ClientOnly, createFileRoute, notFound } from '@tanstack/react-router'

import { TimelineLoading } from '#/features/timeline/TimelineLoading'
import { TimelineRoute } from '#/features/timeline/TimelineRoute'
import { isShareId } from '#/features/timeline/shareLink'
import { noindexMeta } from '#/lib/seo'

export const Route = createFileRoute('/s/$shareId')({
  // A malformed id can never match a stored share, so it is a 404 rather than a
  // request that goes out and comes back empty. Running on the server means the
  // rejection reaches the response as a real status rather than a 200 with an
  // empty body.
  beforeLoad: ({ params }) => {
    if (!isShareId(params.shareId)) throw notFound()
  },
  // Share links expire within a day, and people post them in public places
  // where a crawler will find them. Indexing one would only ever produce a
  // result that is already dead by the time anyone clicks it.
  head: () => ({ meta: noindexMeta }),
  component: SharedTimeline,
})

function SharedTimeline() {
  const { shareId } = Route.useParams()

  return (
    <ClientOnly fallback={<TimelineLoading />}>
      <TimelineRoute shareId={shareId} />
    </ClientOnly>
  )
}
