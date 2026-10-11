# Security

Please report security issues privately to the repository owner rather than posting exploitable details in a public issue.

## Desktop browser boundaries

- Remote websites run in dedicated Chromium-backed WebContentsViews with Node integration disabled, context isolation enabled, sandboxing enabled and web security left on.
- Only the local browser toolbar has a preload bridge. IPC handlers reject senders that are not the trusted toolbar view.
- Address-bar and restored-tab navigation is limited to HTTP and HTTPS. File, javascript and other arbitrary schemes are rejected. Mail links can be handed to the operating system via the mailto scheme.
- Web permission requests are blocked by default unless the user explicitly allows a supported permission. The UI does not receive arbitrary Electron APIs.
- The browser stores cookies/session data and browsing metadata locally on the device. Do not store passwords, OAuth secrets or API tokens in this repository.

## Known limitations

Devil Browser is an early desktop browser built on Electron, not a security-hardened substitute for Google Chrome or Microsoft Edge. It does not yet implement extensions, cloud profile sync, a built-in password manager or automatic security updates. Some websites may reject Electron-based browser clients. Keep Electron dependencies current and review the official [Electron security recommendations](https://www.electronjs.org/docs/latest/tutorial/security/) before adding features.
