# Devil Mail Window — Firefox Extension

Devil Mail Window is a small Firefox WebExtension that opens a dedicated, normal Firefox window for email websites. Mail sites are opened as real tabs, not embedded in an iframe, so each provider controls its own login and website behavior.

## What works in this MVP

- Click the Devil Mail toolbar icon to open or focus the dedicated Devil Mail window.
- Launch Gmail, Outlook, Yahoo Mail, Zoho Mail, Proton Mail, Fastmail, or a custom email website.
- Reuse Firefox's existing sign-in cookies and saved-password autofill.
- Reopen the most recently used mail-site origins in background tabs when a new Devil Mail window is created.
- Keep up to 12 custom or built-in site origins in the local extension storage.

## Install temporarily in Firefox

1. Download or clone this repository and open the firefox-extension folder.
2. In Firefox, open about:debugging#/runtime/this-firefox.
3. Select **Load Temporary Add-on…** and choose firefox-extension/manifest.json.
4. Click the Devil Mail toolbar button.

Temporary add-ons are removed when Firefox restarts; use Firefox's temporary-add-on flow again while developing. This is source code for development, not yet a signed AMO release.

## Login and privacy behavior

Devil Mail does not collect or store email passwords, read inbox contents, or use provider APIs. The actual mail website runs in an ordinary Firefox tab using the Firefox profile's normal website storage and session cookies. A provider can still require you to sign in again when its session expires, you sign out, clear site data, or change security settings.

To support restart/reopen convenience without storing full navigation URLs, the extension saves only HTTPS origins such as https://mail.google.com. It does not save URL paths, query parameters, fragments, credentials, mail content, or access tokens. Restored tabs open at the saved site's root origin.

Only HTTPS addresses are accepted in the custom website field. The extension requests only the storage permission and declares no email-site host permissions or content scripts. Mail sites may use their own security policies or require additional verification; this extension does not attempt to bypass them.

## Test and validate

From the repository root, run:

    npm run check
    npm test

The unit tests cover HTTPS URL validation and safe, deduplicated origin persistence. Install the temporary add-on in Firefox to manually verify the window, website sign-in, and restore flow.
