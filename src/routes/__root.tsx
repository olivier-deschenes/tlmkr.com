import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { createServerFn } from '@tanstack/react-start'
import { getRequestUrl } from '@tanstack/react-start/server'

import { Toaster } from '#/components/ui/sonner'

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
      ],
    }
  },
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
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
