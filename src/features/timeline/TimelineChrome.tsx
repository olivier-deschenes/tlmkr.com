import { IconTimeline } from '@tabler/icons-react'

/**
 * The app's header bar, without any of its controls.
 *
 * Every state that precedes the live editor renders this: the server's first
 * paint, and the moment while timelines are read out of storage. The bar is
 * sticky and 56px tall, so a state that omitted it would let everything below
 * sit 56px too high and then drop once the real header arrived.
 *
 * The brand is a span rather than a link because the only place it would point
 * is the page being loaded.
 */
export function TimelineChrome() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur print:hidden">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
        <span className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight">
          <IconTimeline aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">tlmkr.com</span>
        </span>
      </div>
    </header>
  )
}
