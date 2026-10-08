# Security

Report security issues privately to the repository owner instead of opening a public issue.

Devil Mail Client is intentionally a browser-only application. It does not proxy or inspect third-party mailbox content. Mail providers can reject iframe embedding and can isolate cookies; the app therefore provides an external browser-tab fallback rather than bypassing provider security headers.

Do not store mailbox passwords, OAuth client secrets, refresh tokens, or API keys in this repository.
