# Devil Browser (desktop)

Devil Browser is the actual desktop application for the project. Unlike the retired webmail workspace, it displays websites in isolated Chromium-backed WebContentsView instances rather than iframe embeds. Sites can use normal page navigation, JavaScript, forms, cookies, local storage, downloads and browser permission prompts.

## Development

Requirements: Node.js 22 or newer, npm, and an OS supported by Electron.

Run the following from this directory:

    npm install
    npm start
    npm test
    npm run check

To package for the machine you're building on:

    npm run package -- --linux AppImage deb
    npm run package -- --win nsis
    npm run package -- --mac dmg

Only use the command matching your host operating system. GitHub Actions builds Linux, Windows and macOS packages separately.

## Browser features

- Real web views and independent tabs with new/close/duplicate and right-click tab actions.
- Address bar with HTTP/HTTPS validation and DuckDuckGo search fallback.
- Back, forward, reload/stop, new-tab page, bookmarks and recent history.
- Persistent cookie/session storage for mail and other websites.
- Native downloads menu and download notifications.
- Website permission prompts for notifications, media, geolocation and clipboard access; other permission types are denied.
- Six mail shortcuts: Gmail, Outlook, Yahoo Mail, Zoho, Proton Mail and Fastmail.
- Best-effort unread badges and desktop alerts when a page title exposes a leading unread count, such as (4) Inbox. This is a heuristic, not a provider API integration, and it cannot notify after the browser is closed.
- Clear-cache/cookies/site-storage action in the browser menu.

## Important limits

This is a desktop Chromium-based browser MVP, not a web page and not a rebrand of Google Chrome. It does not currently support Chrome extensions, Google Sync, browser-profile sync, or direct Gmail/Microsoft Graph OAuth integrations. A website may still reject Electron-based browsers or require an up-to-date branded Chrome/Edge build. Website login state is saved locally on the device, not synchronized or backed up to a server.

## Security model

Remote web content is loaded in sandboxed page views with Node integration disabled and context isolation enabled. The local toolbar alone receives a narrow preload IPC bridge. Its IPC handlers validate the sender, and the toolbar's content policy blocks remote scripts. Only HTTP/HTTPS destinations are accepted from the address bar and persisted tab list; arbitrary file, javascript and other schemes are rejected. Do not weaken these controls to work around a website.
