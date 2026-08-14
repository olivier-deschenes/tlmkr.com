import { IconTimeline } from '@tabler/icons-react'

/**
 * The static top of the home screen: mark, heading, and one line of
 * explanation.
 *
 * Three different states put this on screen in turn — the server's first paint,
 * the moment while storage is read, and the live home screen — and they hand
 * over to each other without the heading moving, because all three render this
 * same element tree. Whatever a state adds below the text goes in as children.
 *
 * The heading is fixed here rather than passed in, because the first two states
 * render it before anyone knows whether this browser holds timelines. A heading
 * that named either case would have to be corrected once storage answered, and
 * that correction is visible: a first line that says one thing on the server's
 * paint and another a moment later reads as a glitch, however small the layout
 * change. What differs between a first visit and a return is the content below,
 * where an appearing section is expected.
 *
 * The column is anchored to the top rather than centred vertically, which is
 * what keeps that promise. Centring makes the heading's position a function of
 * how much sits underneath it, so the server's copy — which has no buttons or
 * cards yet — would place it a couple of hundred pixels lower and then jump
 * once the editor hydrated. It also moves on a return visit, when the list of
 * saved timelines appears. Anchoring costs a little symmetry on tall screens
 * and makes the position independent of the contents.
 */
export function TimelineHero({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-2xl flex-col items-center justify-start pt-[12vh] pb-16 text-center">
      <div className="mb-5 flex size-11 items-center justify-center border bg-card">
        <IconTimeline className="size-5" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">
        Create a timeline
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Organize events into clear layers and see days or years in one fitted
        view. Your work stays in this browser.
      </p>
      {children}
    </div>
  )
}
