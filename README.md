# Timeline Maker

A minimalist, browser-local timeline editor built with TanStack Start, TanStack
Router, TanStack Form, TanStack DB, shadcn/ui, and Tailwind CSS.

Timelines are stored only in the current browser. The app has no account,
backend database, cloud sync, or timeline-sharing feature.

## Development

```bash
bun install
bun --bun run dev
```

## Validation

```bash
bun run test
bun run typecheck
bun run lint
bun run check
bun --bun run build
```

## Deployment

The app produces a Cloudflare Workers-compatible TanStack Start build and is
published through Sites.
