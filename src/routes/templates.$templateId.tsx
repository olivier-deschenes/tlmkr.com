import { Link, createFileRoute, notFound } from '@tanstack/react-router'

import { Button } from '#/components/ui/button'
import { LandingLayout } from '#/features/landing/LandingLayout'
import { templateCopy } from '#/features/landing/templateContent'
import { timelineTemplates } from '#/features/timeline/templates'
import { canonical, jsonLd } from '#/lib/seo'
import { SITE_NAME, absoluteUrl } from '#/lib/site'

/**
 * Resolves the pair of records a landing page needs.
 *
 * Only the template is looked up, because `templateContent.test.ts` holds the
 * two sets in step — a template without copy fails the suite rather than
 * reaching here.
 */
function findTemplate(templateId: string) {
  const template = timelineTemplates.find(
    (candidate) => candidate.id === templateId,
  )

  return template ? { template, copy: templateCopy[template.id] } : undefined
}

export const Route = createFileRoute('/templates/$templateId')({
  // Resolved here rather than in the component so an unknown id is a 404 the
  // server reports, instead of a page that renders empty and returns 200.
  loader: ({ params }) => {
    const found = findTemplate(params.templateId)
    if (!found) throw notFound()

    return { copy: found.copy, templateId: params.templateId }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {}

    const { copy, templateId } = loaderData
    const title = `${copy.heading} — free, no sign-up | ${SITE_NAME}`
    const path = `/templates/${templateId}`

    return {
      meta: [
        { title },
        { name: 'description', content: copy.metaDescription },
        { property: 'og:title', content: title },
        { property: 'og:description', content: copy.metaDescription },
        { property: 'og:url', content: absoluteUrl(path) },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: copy.metaDescription },
      ],
      links: [canonical(path)],
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
            {
              '@type': 'ListItem',
              position: 3,
              name: copy.heading,
              item: absoluteUrl(path),
            },
          ],
        }),
      ],
    }
  },
  component: TemplateLanding,
})

function TemplateLanding() {
  const { templateId } = Route.useParams()
  const found = findTemplate(templateId)

  // The loader already threw for an unknown id; this narrows the type.
  if (!found) return null

  const { template, copy } = found

  return (
    <LandingLayout
      breadcrumb={[
        { label: 'Templates', to: '/templates' },
        { label: template.title },
      ]}
      heading={copy.heading}
      intro={copy.intro}
    >
      <Button asChild size="lg">
        <Link to="/" search={{ template: template.id }}>
          Open this template
        </Link>
      </Button>
      <p className="mt-3 text-sm text-muted-foreground">
        Opens a working timeline in this browser. Nothing is uploaded, and there
        is no account to create.
      </p>

      <h2 className="mt-14 text-xl font-semibold tracking-tight">
        What is in it
      </h2>
      <p className="mt-3 leading-7 text-muted-foreground">{copy.layerNote}</p>
      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        {template.layers.map((layer) => (
          <li key={layer.title} className="border bg-card p-4">
            <span className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: layer.color }}
                aria-hidden="true"
              />
              <span className="text-sm font-medium">{layer.title}</span>
            </span>
            {layer.subtitle ? (
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {layer.subtitle}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-muted-foreground">
        {template.layers.length}{' '}
        {template.layers.length === 1 ? 'layer' : 'layers'} and{' '}
        {template.events.length} events, dated around today so the timeline
        opens on something readable rather than a year you have to scroll to.
      </p>

      <h2 className="mt-14 text-xl font-semibold tracking-tight">
        What it suits
      </h2>
      <ul className="mt-4 space-y-2 leading-7 text-muted-foreground">
        {copy.bestFor.map((item) => (
          <li key={item} className="flex gap-3">
            <span aria-hidden="true">—</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-14 text-xl font-semibold tracking-tight">
        Once it is open
      </h2>
      <p className="mt-3 leading-7 text-muted-foreground">
        Drag an event to move it, or drag either edge to change how long it
        runs. Zoom out to see the whole span and back in to work on a week.
        Export the result as a PNG for a deck, an SVG for a design tool, or JSON
        to keep a copy you can reimport later — and undo anything you regret
        with ⌘Z.
      </p>

      <h2 className="mt-14 text-xl font-semibold tracking-tight">
        Other templates
      </h2>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {timelineTemplates
          .filter((candidate) => candidate.id !== template.id)
          .map((candidate) => (
            <li key={candidate.id}>
              <Link
                to="/templates/$templateId"
                params={{ templateId: candidate.id }}
                className="block h-full border bg-card p-4 transition-colors hover:border-foreground/25 hover:bg-accent/40"
              >
                <span className="block text-sm font-medium">
                  {templateCopy[candidate.id].heading}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {candidate.description}
                </span>
              </Link>
            </li>
          ))}
      </ul>
    </LandingLayout>
  )
}
