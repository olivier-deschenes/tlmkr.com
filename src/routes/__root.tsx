import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { createServerFn } from '@tanstack/react-start'
import { getRequestUrl } from '@tanstack/react-start/server'
import { ThemeProvider } from 'next-themes'

import { Toaster } from '#/components/ui/sonner'
import { Button } from '#/components/ui/button'

import appCss from '../styles.css?url'

const getSiteOrigin = createServerFn({ method: 'GET' }).handler(() => ({
  origin: getRequestUrl({ xForwardedHost: true }).origin,
}))

export const Route = createRootRoute({
  loader: () => getSiteOrigin(),
  head: ({ loaderData }) => {
    const description =
      'Create clear, layered timelines with events that can span days or years. Everything stays in your browser.'
    const imageUrl = loaderData
      ? new URL('/og.png', loaderData.origin).toString()
      : undefined

    return {
      meta: [
        {
          charSet: 'utf-8',
        },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1',
        },
        {
          title: 'tlmkr.com',
        },
        {
          name: 'description',
          content: description,
        },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'tlmkr.com' },
        { property: 'og:description', content: description },
        ...(imageUrl
          ? [
              { property: 'og:image', content: imageUrl },
              { property: 'og:image:width', content: '1536' },
              { property: 'og:image:height', content: '1024' },
              { name: 'twitter:card', content: 'summary_large_image' },
              { name: 'twitter:title', content: 'tlmkr.com' },
              { name: 'twitter:description', content: description },
              { name: 'twitter:image', content: imageUrl },
            ]
          : []),
      ],
      links: [
        {
          rel: 'stylesheet',
          href: appCss,
        },
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        {
          rel: 'icon',
          type: 'image/png',
          sizes: '16x16',
          href: '/favicon-16x16.png',
        },
        {
          rel: 'icon',
          type: 'image/png',
          sizes: '32x32',
          href: '/favicon-32x32.png',
        },
        {
          rel: 'apple-touch-icon',
          sizes: '180x180',
          href: '/apple-touch-icon.png',
        },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
    }
  },
  notFoundComponent: NotFoundPage,
  shellComponent: RootDocument,
})

function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          404
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          This timeline went off track.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn’t find this page.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Back to tlmkr.com</Link>
        </Button>
      </div>
    </main>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // next-themes sets the class on <html> before paint, which the server
    // render cannot match; the warning it would raise is expected here.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <Toaster position="bottom-right" />
        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  )
}
