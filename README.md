# Devil Browser

**Devil Browser is being rebuilt as a real desktop browser.** The old GitHub Pages app was only a webmail dashboard, and mail sites commonly block iframe embedding. That was the wrong architecture for the goal.

- **Desktop app source:** [desktop/](desktop/)
- **Open the project page:** https://loverof-darkness.github.io/Devil-Mail-Client/
- **Download CI test builds:** [Desktop Browser Actions](https://github.com/Loverof-Darkness/Devil-Mail-Client/actions/workflows/desktop-browser.yml)
- **Published installers:** [GitHub Releases](https://github.com/Loverof-Darkness/Devil-Mail-Client/releases)

## Run it locally

Requires Node.js 22 or newer.

    cd desktop
    npm install
    npm start

Run browser-core tests with:

    npm test
    npm run check

The desktop workflow builds separate Linux, Windows and macOS packages. Linux builds include AppImage and deb packages; Windows builds an NSIS installer; macOS builds a DMG. CI artifacts are attached to successful Actions runs. Tagged releases use tags beginning with browser-v.

## The browser we're building

The desktop app uses Electron's Chromium-backed WebContentsView for each site instead of putting third-party sites inside iframes. That allows normal browser page behavior, sign-in sessions, navigation, downloads and permission prompts.

Current features include:
- Separate web tabs, new/close/duplicate and right-click tab actions.
- Search/address bar, back/forward, reload/stop and a usable new-tab page.
- Bookmarks, recent history, downloads and persistent site sessions.
- Direct mail shortcuts for Gmail, Outlook, Yahoo Mail, Zoho, Proton Mail and Fastmail.
- Native notifications where the page exposes an unread-count prefix in its title; this is best-effort, not a guaranteed provider API.

## Current limitations

This is the first desktop-browser MVP, not an attempt to rebrand Google Chrome. Chrome extensions, Google Sync, cloud profile sync and direct Gmail/Microsoft Graph OAuth inbox monitoring are not implemented. Some sites may still reject Electron-based browsers or require a branded Chrome/Edge build. Read [desktop/README.md](desktop/README.md) for setup and security details.

## Security

Remote pages are sandboxed with Node integration disabled and context isolation enabled. Only the local toolbar has a narrow IPC bridge, and each IPC handler checks its sender. The address bar accepts HTTP/HTTPS URLs or search terms; file and javascript URLs are rejected. See [SECURITY.md](SECURITY.md).
