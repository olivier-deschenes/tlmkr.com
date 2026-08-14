/** Shown in the tab and in link previews when no timeline is open. */
export const SITE_TITLE = 'tlmkr — timeline maker'

/** Trailing half of a timeline's tab title, e.g. `Apollo program · tlmkr`. */
export const SITE_NAME = 'tlmkr'

/**
 * A timeline's own title leads, so the tab stays readable once it is truncated
 * to a few characters in a crowded tab bar.
 */
export function documentTitle(timelineTitle?: string) {
  const trimmed = timelineTitle?.trim()
  return trimmed ? `${trimmed} · ${SITE_NAME}` : SITE_TITLE
}
