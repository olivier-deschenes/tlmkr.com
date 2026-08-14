# tlmkr.com

A simple, private timeline editor that runs entirely in your browser.

**[Open tlmkr.com](https://tlmkr.com/)**

Your timelines stay in your browser—no account, cloud sync, or backend database.

- Organize events into layers, and drag them to move or resize them.
- Zoom and pan into any stretch of time, from a single week to centuries.
- Export as JSON, PNG, or SVG, or print the timeline directly.
- Share a short read-only link that expires after a day (see below).
- Undo and redo every edit, and press `?` for the full list of shortcuts.

## Sharing

Sharing produces a short, read-only link (`/s/<id>`) that does not let the
recipient touch your copy. It uploads the timeline to Cloudflare KV under a
random id and expires one day later, after which the link stops working.

This is the one case where a timeline leaves the browser. Everything else—
editing, storage, export—still happens locally and touches no server.

Links shared before short links existed carried the timeline in the URL fragment
instead. Those still open, but nothing produces them any more.

## Development

```bash
bun install
bun run dev
```

## Deployment

The app is hosted on Cloudflare Workers. Short links need a KV namespace, which
is created once and then pasted into the `kv_namespaces` entry in
`wrangler.jsonc`:

```bash
wrangler kv namespace create SHARE_LINKS
```

This command creates a production build and deploys it to Cloudflare using
Wrangler:

```bash
bun run deploy
```
