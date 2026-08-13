import { createFileRoute } from '@tanstack/react-router'

import { TimelineRoute } from '#/features/timeline/TimelineRoute'

export const Route = createFileRoute('/')({
  ssr: false,
  component: Home,
})

function Home() {
  return <TimelineRoute />
}
