/**
 * Copy for the crawlable part of the home page.
 *
 * It lives apart from the components because the FAQ is rendered twice: once as
 * markup a reader sees, and once as `FAQPage` structured data. Google treats an
 * answer that appears only in the JSON-LD as a violation, so the two have to
 * come from the same place rather than be kept in sync by hand.
 *
 * Every claim here is one the app actually delivers. Notably absent: anything
 * about working offline, which would need a service worker the app does not
 * ship.
 */

export interface Feature {
  title: string
  body: string
}

export const features: ReadonlyArray<Feature> = [
  {
    title: 'Layers keep parallel stories apart',
    body: 'Each team, workstream, or storyline gets its own lane, so overlapping work reads as overlapping instead of collapsing into one crowded row.',
  },
  {
    title: 'Events span time, not just points',
    body: 'An event can sit on a single day or stretch across years. Drag either edge to change how long it runs, or drag the middle to move the whole thing.',
  },
  {
    title: 'One view, from a week to a century',
    body: 'Zoom and pan to any stretch of time. The timeline refits itself to whatever range you land on, so a sprint and a dynasty get the same treatment.',
  },
  {
    title: 'Export as PNG, SVG, or JSON',
    body: 'Take an image into a deck, an SVG into a design tool, or the raw JSON into your own scripts. You can also print the timeline straight from the browser.',
  },
  {
    title: 'Undo and redo every edit',
    body: 'Every change is reversible with ⌘Z, including deleting a whole timeline. Press ? at any point for the full list of keyboard shortcuts.',
  },
  {
    title: 'Bring events you already have',
    body: 'Import a JSON file directly, or copy a ready-made prompt into ChatGPT, Claude, or Gemini, and paste the events it writes back into the timeline.',
  },
]

export interface FaqItem {
  question: string
  answer: string
}

export const faq: ReadonlyArray<FaqItem> = [
  {
    question: 'Is tlmkr free?',
    answer:
      'Yes. Every feature is free, there is nothing to install, and there is no account to create. You can start a timeline the moment the page loads.',
  },
  {
    question: 'Does my timeline leave my browser?',
    answer:
      'No. Timelines are saved in your own browser and are never uploaded, so no server holds a copy. The single exception is sharing: creating a share link uploads that one timeline so the recipient can open it.',
  },
  {
    question: 'What can I export?',
    answer:
      'PNG for slides and documents, SVG for design tools, and JSON for the complete timeline as structured data. You can also print directly from the browser.',
  },
  {
    question: 'How does sharing work?',
    answer:
      'Sharing creates a short read-only link that expires one day later. Whoever opens it sees a copy and cannot change yours. After a day the link stops working and the stored copy is gone.',
  },
  {
    question: 'Can I import events I already have?',
    answer:
      'Yes. tlmkr reads a JSON file of events, and it can also write a prompt for ChatGPT, Claude, or Gemini describing the format, so an assistant can draft the events for you to paste in.',
  },
  {
    question: 'What happens if I clear my browser data?',
    answer:
      'Timelines are stored in this browser, so clearing site data removes them. Export a timeline as JSON first if you want a copy you can reimport later or move to another machine.',
  },
]
