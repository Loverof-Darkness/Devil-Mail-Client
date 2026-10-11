import {
  WINDOW_ID_KEY,
  SAVED_ORIGINS_KEY,
  normalizeHttpsAddress,
  mergeSavedOrigin,
  sanitizeSavedOrigins
} from "./core.js";

let launchInFlight = null;

async function getSavedOrigins() {
  const stored = await browser.storage.local.get(SAVED_ORIGINS_KEY);
  return sanitizeSavedOrigins(stored[SAVED_ORIGINS_KEY]);
}

async function openOrFocusWindow() {
  if (launchInFlight) {
    return launchInFlight;
  }

  launchInFlight = (async () => {
    const state = await browser.storage.local.get([WINDOW_ID_KEY, SAVED_ORIGINS_KEY]);
    const previousWindowId = state[WINDOW_ID_KEY];

    if (Number.isInteger(previousWindowId)) {
      try {
        await browser.windows.get(previousWindowId);
        await browser.windows.update(previousWindowId, { focused: true });
        return previousWindowId;
      } catch {
        // The stored window was closed or Firefox restarted. Create a fresh one.
      }
    }

    const windowInfo = await browser.windows.create({
      url: browser.runtime.getURL("hub.html"),
      type: "normal",
      width: 1120,
      height: 800,
      focused: true,
      titlePreface: "Devil Mail — "
    });

    await browser.storage.local.set({ [WINDOW_ID_KEY]: windowInfo.id });
    const origins = sanitizeSavedOrigins(state[SAVED_ORIGINS_KEY]);
    await browser.storage.local.set({ [SAVED_ORIGINS_KEY]: origins });

    // Restore previously used mail-site origins in background tabs. We save origins,
    // not query strings, fragments, email content, or credentials.
    for (const origin of origins) {
      try {
        await browser.tabs.create({
          windowId: windowInfo.id,
          url: origin,
          active: false
        });
      } catch (error) {
        console.warn("Could not restore a saved mail website.", error);
      }
    }
    return windowInfo.id;
  })();

  try {
    return await launchInFlight;
  } finally {
    launchInFlight = null;
  }
}

async function openSiteInWindow(message, sender) {
  const hubUrl = browser.runtime.getURL("hub.html");
  if (!sender.tab || sender.url !== hubUrl) {
    return { ok: false, error: "Open websites from the Devil Mail home page." };
  }

  let website;
  try {
    website = normalizeHttpsAddress(message.url);
  } catch (error) {
    return { ok: false, error: error.message };
  }

  try {
    await browser.windows.get(sender.tab.windowId);
  } catch {
    return { ok: false, error: "The Devil Mail window is no longer available. Click the extension icon to reopen it." };
  }

  const stored = await browser.storage.local.get(SAVED_ORIGINS_KEY);
  const savedOrigins = mergeSavedOrigin(stored[SAVED_ORIGINS_KEY], website.origin);
  await browser.storage.local.set({ [SAVED_ORIGINS_KEY]: savedOrigins });

  try {
    await browser.tabs.create({
      windowId: sender.tab.windowId,
      url: website.url,
      active: true
    });
  } catch {
    return { ok: false, error: "Firefox could not open that website. Check the address and try again." };
  }

  return { ok: true, origin: website.origin };
}

browser.action.onClicked.addListener(() => {
  openOrFocusWindow().catch((error) => {
    console.error("Devil Mail could not open its window.", error);
  });
});

browser.windows.onRemoved.addListener((removedWindowId) => {
  browser.storage.local.get(WINDOW_ID_KEY).then(async (stored) => {
    if (stored[WINDOW_ID_KEY] === removedWindowId) {
      await browser.storage.local.remove(WINDOW_ID_KEY);
    }
  }).catch((error) => {
    console.warn("Could not clear the closed window reference.", error);
  });
});

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "devil-mail/open-site") {
    return openSiteInWindow(message, sender);
  }
  return undefined;
});
