import { Spinner } from '#/components/ui/spinner'
import { TimelineChrome } from '#/features/timeline/TimelineChrome'

/**
 * Shown while a timeline is being read out of this browser.
 *
 * Two moments render it: the server's first paint, which cannot touch storage
 * at all, and the frame or two after hydration while the collection loads. Both
 * use the same markup as the loaded editor's frame, so the header and the
 * content area keep their positions and only the middle fills in.
 *
 * The spinner carries `tlmkr-deferred`, which keeps it invisible for the first
 * quarter second. A local-storage read is normally done well inside that, and a
 * spinner that appears and disappears within a couple of frames reads as a
 * glitch rather than as progress. It only becomes visible on the slow reads
 * where someone would otherwise be looking at an empty page.
 */
export function TimelineLoading() {
  return (
    <div className="min-h-screen bg-background">
      <TimelineChrome />
      <main className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6">
        {/* Anchored with the same offset the hero uses, so the spinner marks
            the spot the content is about to occupy. */}
        <div className="flex min-h-[calc(100vh-10rem)] items-start justify-center pt-[12vh]">
          <Spinner className="tlmkr-deferred size-5 text-muted-foreground" />
          <span className="sr-only">Loading timelines</span>
        </div>
      </main>
    </div>
  )
}
