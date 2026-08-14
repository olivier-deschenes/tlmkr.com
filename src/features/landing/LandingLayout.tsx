import { IconTimeline } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

export interface Crumb {
  label: string
  /** Omitted on the last crumb, which is the page you are already on. */
  to?: string
}

/**
 * Chrome for the content pages.
 *
 * These sit outside the editor and are fully server rendered, so they get a
 * plain header rather than the app's — the app header carries timeline
 * controls that would have nothing to act on here.
 */
export function LandingLayout({
  breadcrumb,
  heading,
  intro,
  children,
}: {
  breadcrumb: Array<Crumb>
  heading: string
  intro: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-4xl items-center px-6">
          <Link
            to="/"
            aria-label="tlmkr.com home"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <IconTimeline aria-hidden="true" className="size-4" />
            tlmkr.com
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 py-12 sm:py-16">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <li>
              <Link to="/" className="hover:text-foreground">
                Timeline maker
              </Link>
            </li>
            {breadcrumb.map((crumb) => (
              <li key={crumb.label} className="flex items-center gap-2">
                <span aria-hidden="true">/</span>
                {crumb.to ? (
                  <Link to={crumb.to} className="hover:text-foreground">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          {heading}
        </h1>
        <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
          {intro}
        </p>

        <div className="mt-12">{children}</div>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-4xl flex-wrap gap-x-6 gap-y-2 px-6 py-8 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Timeline maker
          </Link>
          <Link to="/templates" className="hover:text-foreground">
            Templates
          </Link>
        </div>
      </footer>
    </div>
  )
}
