# Devil Mail Client

Devil Mail Client is a browser-style mail workspace. It keeps each webmail service in a named tab, remembers the workspace locally, and can monitor CORS-enabled mail status feeds to raise desktop notifications.

## What is shipped

- Named mail tabs with add, rename, and close.
- Browser-style address bar, local back/forward URL history, reload, and open-in-new-tab fallback.
- Persistent local workspace using versioned `localStorage`.
- PWA manifest + service worker with desktop notifications while the workspace is running.
- Per-tab unread badges and polling state.
- Optional CORS-enabled JSON monitor endpoint per tab.
- Import/export of workspace settings.
- Strict URL validation and safe DOM rendering. No `eval`, no dynamic HTML injection.
- GitHub Pages deployment workflow.

## Browser/security reality

A normal web page cannot read another origin's DOM or cookies. Many mail providers also send `Content-Security-Policy: frame-ancestors` or `X-Frame-Options`, which prevents them from being embedded in an iframe. When that happens, Devil Mail Client keeps the tab and lets you open the site in a normal browser tab/window instead. See MDN's framing guidance for the underlying browser security model.

Unread monitoring runs while the app is open. Browser timer throttling varies by OS/browser, so this release does not claim guaranteed closed-app/background mail delivery. For that, use the planned server-side Web Push/provider adapter path below.

For unread monitoring, the app expects a CORS-enabled HTTPS JSON endpoint that returns at least one of:

```json
{
  "unreadCount": 4,
  "latestMessageId": "abc123",
  "latestSubject": "New mail",
  "latestFrom": "sender@example.com"
}
```

The monitor adapter intentionally does not collect or proxy mailbox credentials. A future backend/provider connector can implement Gmail, Microsoft Graph, IMAP, or another provider without weakening the browser security model.

## Run locally

Serve the repository with any static HTTP server. For example:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Deploy

The repository includes `.github/workflows/pages.yml`. Enable GitHub Pages with GitHub Actions as the source, then push to `main`.

## Files

- `index.html` - app shell.
- `app.js` - UI/state orchestration.
- `core/storage.js` - versioned persistence and import/export.
- `core/url.js` - safe URL handling.
- `core/monitor.js` - polling + notification adapter.
- `styles.css` - responsive dark UI.
- `sw.js` - PWA service worker.
- `_headers` - optional headers file for static hosts such as Cloudflare Pages.

## Roadmap

The architecture is intentionally adapter-based so provider OAuth connectors can be added without replacing the workspace UI. Gmail and Microsoft Graph are the first natural provider integrations for background mail counts.
