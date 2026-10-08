# Devil Mail Client architecture

## Product model

```text
                 ┌─────────────────────────────┐
                 │         Devil Mail UI        │
                 │  tabs · toolbar · settings  │
                 └─────────────┬───────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
        browser workspace              mail monitors
        (iframe / external)          (HTTPS + CORS JSON)
                │                             │
          third-party site              user's endpoint
```

The web app owns workspace state. A mail provider owns its login session and mailbox content. The app does not proxy provider pages, scrape cookies, or try to defeat framing controls.

## Workspace state

`core/storage.js` keeps a versioned object in `localStorage`. User-entered URLs are normalized to HTTPS before persistence. Mail credentials are never part of the workspace export.

Each tab stores:

- display name
- current URL
- small local navigation history
- unread count
- latest message metadata
- monitor endpoint + interval
- last successful/error check timestamp

## Monitoring contract

`core/monitor.js` consumes a deliberately small adapter contract:

```json
{
  "unreadCount": 4,
  "latestMessageId": "abc123",
  "latestSubject": "New mail",
  "latestFrom": "sender@example.com"
}
```

The endpoint must be HTTPS, reachable by browser `fetch`, and explicitly allow CORS. Requests omit credentials. This keeps monitoring separate from the webmail page and avoids putting mailbox passwords in the client.

The first successful check establishes a baseline. A later unread increase or latest-message ID change raises a notification.

## Browser constraints

Third-party pages can stop a site from being embedded using `Content-Security-Policy: frame-ancestors` or `X-Frame-Options`. Cross-origin browser code also cannot inspect a framed page's DOM or cookies. Therefore the app never assumes that an iframe can behave like a full browser.

When a provider blocks framing, the user can open the service in a normal browser tab/window. The workspace tab remains available for the next visit.

## Production path

The static PWA is intentionally dependency-free and can be hosted on GitHub Pages or another static HTTPS host.

For always-on mailbox notifications, add a server-side provider adapter later:

```text
OAuth provider
     │
     ▼
provider adapter ──► unread/mail state API ──► notification service
                                              │
                                      Web Push subscription
                                              │
                                              ▼
                                      Devil Mail service worker
```

That backend should hold refresh tokens server-side, enforce per-user authorization, and never accept arbitrary proxy URLs. Gmail and Microsoft Graph are natural first adapters.
