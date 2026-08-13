# tlmkr.com

A simple, private timeline editor that runs entirely in your browser.

**[Open tlmkr.com](https://tlmkr.com/)**

Your timelines stay in your browser—no account, cloud sync, or backend database.

- Organize events into layers, and drag them to move or resize them.
- Zoom and pan into any stretch of time, from a single week to centuries.
- Export as JSON, PNG, or SVG, or print the timeline directly.
- Share a read-only link. The timeline is packed into the URL fragment, which
  browsers never send to a server, so sharing still involves no backend.
- Undo and redo every edit, and press `?` for the full list of shortcuts.

## Development

```bash
bun install
bun run dev
```

## Deployment

The app is hosted on Cloudflare Workers. This command creates a production build
and deploys it to Cloudflare using Wrangler:

```bash
bun run deploy
```
