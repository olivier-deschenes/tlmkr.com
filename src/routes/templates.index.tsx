import { Link, createFileRoute } from '@tanstack/react-router'

import { LandingLayout } from '#/features/landing/LandingLayout'
import { templateCopy } from '#/features/landing/templateContent'
import { timelineTemplates } from '#/features/timeline/templates'
import { canonical, jsonLd } from '#/lib/seo'
import { SITE_NAME, absoluteUrl } from '#/lib/site'

const title = `Timeline templates — free, no sign-up | ${SITE_NAME}`
const description =
  'Free timeline templates for product roadmaps, project plans, and life stories. Each opens as a working timeline in your browser, with no account needed.'

export const Route = createFileRoute('/templates/')({
  head: () => ({
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: absoluteUrl('/templates') },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ],
    links: [canonical('/templates')],
    scripts: [
      jsonLd({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Timeline maker',
            item: absoluteUrl('/'),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Templates',
            item: absoluteUrl('/templates'),
          },
        ],
      }),
    ],
  }),
  component: TemplatesIndex,
})

function TemplatesIndex() {
  return (
    <LandingLayout
      breadcrumb={[{ label: 'Templates' }]}
      heading="Timeline templates"
      intro="Every template opens as a real timeline with its layers and events already in place, dated around today. Nothing is locked: rename a layer, drag an event, delete the half you do not need."
    >
      <ul className="grid gap-2 sm:grid-cols-2">
        {timelineTemplates.map((template) => {
          const copy = templateCopy[template.id]

          return (
            <li key={template.id}>
              <Link
                to="/templates/$templateId"
                params={{ templateId: template.id }}
                className="block h-full border bg-card p-5 transition-colors hover:border-foreground/25 hover:bg-accent/40"
              >
                <span className="flex items-center gap-1.5">
                  {template.layers.map((layer) => (
                    <span
                      key={layer.title}
                      className="size-2 rounded-full"
                      style={{ backgroundColor: layer.color }}
                      aria-hidden="true"
                    />
                  ))}
                </span>
                <span className="mt-2 block font-medium">{copy.heading}</span>
                <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                  {template.description}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </LandingLayout>
  )
}
