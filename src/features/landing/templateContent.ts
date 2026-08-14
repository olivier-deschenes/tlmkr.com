/**
 * Landing-page copy for each starter template.
 *
 * Kept out of `templates.ts` because that file describes what a template *is* —
 * its layers, its events, the shape the editor builds from it — while this
 * describes who a template is for. The two change for different reasons and at
 * different times.
 *
 * `templateContent.test.ts` asserts every template has an entry here, so adding
 * a starter without copy fails the suite rather than shipping a landing page
 * that falls back to one line of text.
 */

export interface TemplateCopy {
  /** Leads the page and the `<title>`; phrased the way someone would search. */
  heading: string
  /** Meta description. Aim for roughly 150 characters. */
  metaDescription: string
  /** Opening paragraph, shown under the heading. */
  intro: string
  /** Concrete situations this starter suits, rendered as a list. */
  bestFor: ReadonlyArray<string>
  /** How the layers are meant to be read, once the timeline is open. */
  layerNote: string
}

export const templateCopy: Record<string, TemplateCopy> = {
  'product-roadmap': {
    heading: 'Product roadmap timeline template',
    metaDescription:
      'A free product roadmap timeline template with one lane per team. Opens in your browser, no sign-up, and exports to PNG, SVG, or JSON.',
    intro:
      'A roadmap goes wrong when everything lands in a single row and the quarter looks empty right up until it looks impossible. This starter gives platform, product, and go-to-market their own lanes, so the overlaps are visible on the way in rather than in the retrospective.',
    bestFor: [
      'Showing a quarter or a year of work across several teams at once',
      'Making dependencies obvious, where one lane has to finish before another starts',
      'Taking a roadmap into a review deck as a PNG or SVG',
      'Replacing a roadmap spreadsheet nobody scrolls to the right of',
    ],
    layerNote:
      'Platform sits at the top because the work under it usually gates the rest. Product runs underneath, and go-to-market last, where a launch campaign should visibly trail the launch it depends on.',
  },
  'project-plan': {
    heading: 'Project timeline template',
    metaDescription:
      'A free project timeline template with phases and review gates. Build it in your browser with no account, then export to PNG, SVG, or JSON.',
    intro:
      'One project, broken into phases, with the review gates marked as their own events rather than buried in a phase that has already started. Discovery, build, and hardening run as spans; kickoff, midpoint, and go/no-go sit on single days where a date slipping is immediately obvious.',
    bestFor: [
      'Planning a project with clear phases and a decision point between them',
      'Showing a client or a steering group where the gates are',
      'Tracking a delivery whose end date matters more than its detail',
      'Printing a one-page plan to bring into a room',
    ],
    layerNote:
      'The delivery lane carries the phases, and the reviews lane keeps the gates separate so they stay readable when a phase runs long and swallows the space around it.',
  },
  'personal-history': {
    heading: 'Life timeline template',
    metaDescription:
      'A free timeline template for a life story or company history, spanning decades. Runs entirely in your browser with nothing uploaded.',
    intro:
      'Long spans, measured in decades rather than sprints. This starter suits a biography, a family history, or the story of how a company got where it is — anything where the interesting part is how the chapters sit against each other, not what happened in a given week.',
    bestFor: [
      'A personal or family history covering several decades',
      'A company story told from founding to now',
      'A research or teaching timeline where eras overlap',
      'Any history where you want the long view and the turning points together',
    ],
    layerNote:
      'Chapters run as long spans across the top, with milestones marked below as single days, so an era and the moment that ended it can be read on the same screen.',
  },
}
