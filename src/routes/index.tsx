import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { TimelineRoute } from '#/features/timeline/TimelineRoute'
import { HomeContent } from '#/features/landing/HomeContent'
import { HomeHero } from '#/features/landing/HomeHero'
import { faq, features } from '#/features/landing/content'
import { canonical, jsonLd } from '#/lib/seo'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '#/lib/site'

export const Route = createFileRoute('/')({
  validateSearch: z.object({
    /** Set by a template landing page to open that starter straight away. */
    template: z.string().optional(),
  }),
  // Unlike the other timeline routes this one renders on the server. The editor
  // below still cannot — it reads this browser's storage — but the page around
  // it can, and that is the only thing a crawler ever gets to read.
  //
  // The canonical stays bare `/` on purpose: `?template=` produces the same page
  // and only differs in what it does after hydration, so it is not a second URL
  // worth indexing.
  head: () => ({
    links: [canonical('/')],
    scripts: [
      jsonLd({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: SITE_NAME,
        url: SITE_URL,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Any device with a modern web browser',
        browserRequirements: 'Requires JavaScript',
        description: SITE_DESCRIPTION,
        // The app is free outright rather than free to try, which is what a
        // zero price with no accompanying subscription offer states.
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        featureList: features.map((feature) => feature.title),
      }),
      jsonLd({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      }),
    ],
  }),
  component: Home,
})

function Home() {
  const { template } = Route.useSearch()

  return (
    <>
      <ClientOnly fallback={<HomeHero />}>
        <TimelineRoute templateId={template} />
      </ClientOnly>
      <HomeContent />
    </>
  )
}
