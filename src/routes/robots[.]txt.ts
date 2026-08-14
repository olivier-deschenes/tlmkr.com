import { createFileRoute } from '@tanstack/react-router'

import { SITE_URL, absoluteUrl } from '#/lib/site'

/**
 * Without this the SPA catch-all answers `/robots.txt` with the app shell, and
 * a crawler that asks for rules gets `text/html` back — which means the sitemap
 * below is never discovered.
 *
 * Share links and timeline ids are deliberately *not* disallowed. A crawler has
 * to fetch a page to see its `noindex`, so blocking those paths here would do
 * the opposite of what it looks like: a share link someone posted publicly
 * could still land in the index as a bare URL, and Google would never be
 * allowed to read the tag that says to drop it.
 */
const body = `# ${SITE_URL}
User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${absoluteUrl('/sitemap.xml')}
`

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () =>
        new Response(body, {
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'public, max-age=3600',
          },
        }),
    },
  },
})
