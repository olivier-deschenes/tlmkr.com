import { Link } from '@tanstack/react-router'

import { faq, features } from '#/features/landing/content'
import { timelineTemplates } from '#/features/timeline/templates'

/**
 * The part of the home page that is server rendered.
 *
 * The editor above it is client only — it reads timelines out of this browser,
 * which a server cannot do — so without this section the document a crawler
 * receives is an empty shell. It sits below the editor because the editor is
 * what someone came for; this is what explains the page to anyone, or anything,
 * that arrives without having heard of it.
 */
export function HomeContent() {
  return (
    <section className="border-t bg-muted/30 print:hidden">
      <div className="mx-auto w-full max-w-4xl px-6 py-16 sm:py-20">
        <h2 className="text-2xl font-semibold tracking-tight">
          A timeline maker that runs entirely in your browser
        </h2>
        <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
          tlmkr builds layered timelines out of events that can last a day or a
          decade. There is no account, no upload step, and no server holding
          your work — timelines are saved in this browser and stay there until
          you export them or delete them.
        </p>

        <h2 className="mt-14 text-2xl font-semibold tracking-tight">
          What you can do with it
        </h2>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {features.map((feature) => (
            <li key={feature.title} className="border bg-card p-5">
              <h3 className="text-sm font-medium">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {feature.body}
              </p>
            </li>
          ))}
        </ul>

        <h2 className="mt-14 text-2xl font-semibold tracking-tight">
          Timeline templates
        </h2>
        <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
          Each template opens a working timeline with its layers and events
          already in place, dated around today, so you can rename things instead
          of starting from an empty canvas.
        </p>
        <ul className="mt-6 grid gap-2 sm:grid-cols-3">
          {timelineTemplates.map((template) => (
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
                <span className="mt-2 block text-sm font-medium">
                  {template.title} timeline template
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {template.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <h2 className="mt-14 text-2xl font-semibold tracking-tight">
          Common questions
        </h2>
        <dl className="mt-6 divide-y border-y">
          {faq.map((item) => (
            <div key={item.question} className="py-5">
              <dt className="text-sm font-medium">{item.question}</dt>
              <dd className="mt-2 text-sm leading-6 text-muted-foreground">
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
