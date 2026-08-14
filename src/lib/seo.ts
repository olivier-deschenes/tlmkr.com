import { absoluteUrl } from '#/lib/site'

/**
 * Canonicals are declared per route rather than once at the root. Head entries
 * from every matched route are concatenated, so a root-level canonical would
 * survive alongside the child's and leave two competing tags on the page.
 */
export function canonical(path: string) {
  return { rel: 'canonical', href: absoluteUrl(path) }
}

/**
 * Keeps a page out of the index while still letting a crawler follow its links
 * back into the site.
 *
 * `googlebot` repeats the directive because Google honours the more specific
 * token when both are present, and being explicit costs nothing.
 */
export const noindexMeta = [
  { name: 'robots', content: 'noindex, follow' },
  { name: 'googlebot', content: 'noindex, follow' },
]

/**
 * Renders a structured-data block.
 *
 * The `<` escape matters: a literal `</script>` anywhere in the payload would
 * close the tag early and spill the rest of the JSON into the document as
 * markup. Everything passed in today is authored by us, but the escape keeps
 * that from becoming a trap the first time a value comes from user text.
 */
export function jsonLd(data: unknown) {
  return {
    type: 'application/ld+json',
    children: JSON.stringify(data).replace(/</g, '\\u003c'),
  }
}
