/**
 * Canonical production origin. Every absolute URL the site advertises —
 * canonicals, `og:image`, the sitemap, structured data — hangs off this rather
 * than off the incoming request, so a preview deployment on `workers.dev` never
 * nominates itself as the copy worth indexing.
 */
export const SITE_URL = 'https://tlmkr.com'

/** Trailing half of a timeline's tab title, e.g. `Apollo program · tlmkr`. */
export const SITE_NAME = 'tlmkr'

/**
 * Leads with what someone actually types into a search box. The brand goes last
 * because nobody searches for it yet, and the two qualifiers after the dash are
 * the things competitors in this niche cannot claim.
 */
export const SITE_TITLE = 'Free Timeline Maker — No Sign-Up, Private | tlmkr'

/** Shown under the title in search results and in link previews. */
export const SITE_DESCRIPTION =
  'Build layered timelines in your browser. Drag events, zoom from days to centuries, export PNG, SVG or JSON. Free, no account, nothing leaves your device.'

/** Resolves a site-relative path against {@link SITE_URL}. */
export function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString()
}

/**
 * A timeline's own title leads, so the tab stays readable once it is truncated
 * to a few characters in a crowded tab bar.
 */
export function documentTitle(timelineTitle?: string) {
  const trimmed = timelineTitle?.trim()
  return trimmed ? `${trimmed} · ${SITE_NAME}` : SITE_TITLE
}
