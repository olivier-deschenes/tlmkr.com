import { createFileRoute } from '@tanstack/react-router'

import { absoluteUrl } from '#/lib/site'
import { timelineTemplates } from '#/features/timeline/templates'

interface SitemapEntry {
  path: string
  priority: string
}

/**
 * Only pages that are the same for every visitor belong here. A saved timeline
 * lives at a random id in one browser and a share link expires within a day, so
 * neither is a URL worth pointing a crawler at.
 */
const entries: Array<SitemapEntry> = [
  { path: '/', priority: '1.0' },
  { path: '/templates', priority: '0.8' },
  ...timelineTemplates.map((template) => ({
    path: `/templates/${template.id}`,
    priority: '0.7',
  })),
]

function renderSitemap(lastModified: string) {
  const urls = entries
    .map(
      ({ path, priority }) =>
        `  <url>\n` +
        `    <loc>${absoluteUrl(path)}</loc>\n` +
        `    <lastmod>${lastModified}</lastmod>\n` +
        `    <priority>${priority}</priority>\n` +
        `  </url>`,
    )
    .join('\n')

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls}\n` +
    `</urlset>\n`
  )
}

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () =>
        new Response(renderSitemap(new Date().toISOString().slice(0, 10)), {
          headers: {
            'content-type': 'application/xml; charset=utf-8',
            'cache-control': 'public, max-age=3600',
          },
        }),
    },
  },
})
