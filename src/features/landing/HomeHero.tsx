import { TimelineChrome } from '#/features/timeline/TimelineChrome'
import { TimelineHero } from '#/features/timeline/TimelineHero'

/**
 * Stands in for the editor on the home page until its timelines are read.
 *
 * The editor cannot render on the server, so something has to hold the space,
 * and a bare spinner would leave the document without a heading for a crawler
 * to read. This reuses the editor's own frame and hero, which means the heading
 * it carries is already sitting where the live home screen will put it — the
 * buttons and the template cards simply appear underneath.
 *
 * Two moments render it, and they run back to back: the server's paint, and the
 * gap after hydration while the collection reads local storage. `TimelineApp`
 * renders this same component for the second, so the heading is painted once
 * and never repainted, whether or not this browser turns out to hold anything.
 */
export function HomeHero() {
  return (
    <div className="min-h-screen bg-background">
      <TimelineChrome />
      <main className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6">
        <TimelineHero />
      </main>
    </div>
  )
}
