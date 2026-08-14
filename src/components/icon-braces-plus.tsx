/**
 * Tabler's braces with a plus set between them, drawn here because the icon set
 * has no such pair. Same 24px grid and stroke as the rest, so it lines up with
 * the tabler icons it sits beside.
 */
export function IconBracesPlus(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M7 4a2 2 0 0 0 -2 2v3a2 2 0 0 1 -2 2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2" />
      <path d="M17 4a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2a2 2 0 0 0 -2 2v3a2 2 0 0 1 -2 2" />
      <path d="M12 9.5v5" />
      <path d="M9.5 12h5" />
    </svg>
  )
}
