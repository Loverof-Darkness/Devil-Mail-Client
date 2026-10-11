import {
  app, BaseWindow, WebContentsView, ipcMain, session, shell, dialog,
  Menu, Notification, clipboard
} from "electron";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  NEW_TAB_URL, MAIL_SERVICES, isWebUrl, normalizeAddress,
  normalizeStoredUrl, extractUnreadCount, sanitizePersistedState
} from "./browser-core.js";
import { registerBrowserMenus } from "./menus.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CHROME_FILE = path.join(ROOT, "chrome.html");
const PRELOAD_FILE = path.join(ROOT, "preload.cjs");
const START_FILE = path.join(ROOT, "newtab.html");
const PARTITION = "persist:devil-browser";
const CHROME_HEIGHT = 128;
const MAX_TABS = 30;
const browserSession = session.fromPartition(PARTITION);
let mainWindow = null;
let chromeView = null;
let tabs = [];
let activeTabId = null;
let bookmarks = [];
let history = [];
let downloads = [];
const downloadItems = new Map();
const permissionGrants = new Set();

app.setName("Devil Browser");
if (process.platform === "win32") app.setAppUserModelId("com.loverofdarkness.devilbrowser");

function stateFile() {
  return path.join(app.getPath("userData"), "browser-state.json");
}

function readPersistentState() {
  try {
    const file = stateFile();
    if (existsSync(file)) return sanitizePersistedState(JSON.parse(readFileSync(file, "utf8")));
  } catch (error) {
    console.warn("Could not restore browser state:", error.message);
  }
  return { tabs: [], activeTabId: null, bookmarks: [], history: [] };
}

function persistState() {
  try {
    const userData = app.getPath("userData");
    mkdirSync(userData, { recursive: true });
    const safeState = {
      tabs: tabs.map((tab) => ({
        id: tab.id,
        url: tab.url,
        title: tab.title,
        unreadCount: tab.unreadCount
      })),
      activeTabId,
      bookmarks,
      history: history.slice(0, 500)
    };
    writeFileSync(stateFile(), JSON.stringify(safeState, null, 2), { mode: 0o600 });
  } catch (error) {
    console.warn("Could not save browser state:", error.message);
  }
}

function publicState() {
  return {
    tabs: tabs.map((tab) => ({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      loading: tab.loading,
      error: tab.error,
      unreadCount: tab.unreadCount,
      canGoBack: !tab.view.webContents.isDestroyed() && tab.view.webContents.canGoBack(),
      canGoForward: !tab.view.webContents.isDestroyed() && tab.view.webContents.canGoForward(),
      isBookmarked: isBookmarked(tab.url)
    })),
    activeTabId,
    bookmarks: bookmarks.slice(),
    history: history.slice(0, 200),
    downloads: downloads.map(({ id, url, filename, state, receivedBytes, totalBytes }) => ({
      id, url, filename, state, receivedBytes, totalBytes
    }))
  };
}

function sendState() {
  if (chromeView && !chromeView.webContents.isDestroyed()) {
    chromeView.webContents.send("browser:state", publicState());
  }
}

function isBookmarked(url) {
  return bookmarks.some((item) => item.url === url);
}

function setWindowTitle() {
  if (!mainWindow) return;
  const current = tabs.find((tab) => tab.id === activeTabId);
  mainWindow.setTitle(current ? (current.title || current.url) + " — Devil Browser" : "Devil Browser");
}

function layoutViews() {
  if (!mainWindow || !chromeView) return;
  const size = mainWindow.getContentSize();
  const width = Math.max(1, size[0]);
  const height = Math.max(1, size[1]);
  chromeView.setBounds({ x: 0, y: 0, width, height: CHROME_HEIGHT });
  for (const tab of tabs) {
    tab.view.setBounds({
      x: 0,
      y: CHROME_HEIGHT,
      width,
      height: Math.max(1, height - CHROME_HEIGHT)
    });
  }
}

function addHistoryEntry(url, title) {
  if (!isWebUrl(url)) return;
  const existing = history[0];
  const entry = { url, title: String(title || new URL(url).hostname).slice(0, 160), visitedAt: Date.now() };
  if (existing && existing.url === url) {
    history[0] = entry;
  } else {
    history.unshift(entry);
    history = history.slice(0, 500);
  }
}

function startNotification(title, body, tag) {
  if (!Notification.isSupported()) return;
  try {
    new Notification({ title, body, silent: false, urgency: "normal" }).show();
  } catch (error) {
    console.warn("Could not show notification:", error.message);
  }
}

function focusChromeAddress() {
  if (chromeView && !chromeView.webContents.isDestroyed()) {
    chromeView.webContents.send("browser:focus-address");
  }
}

function setActiveTab(id) {
  if (!tabs.some((tab) => tab.id === id)) return false;
  activeTabId = id;
  for (const tab of tabs) tab.view.setVisible(tab.id === id);
  layoutViews();
  setWindowTitle();
  persistState();
  sendState();
  return true;
}

function getTab(id) {
  return tabs.find((tab) => tab.id === id);
}

function isStartFile(url) {
  try {
    return new URL(url).protocol === "file:" &&
      path.resolve(fileURLToPath(url)) === path.resolve(START_FILE);
  } catch {
    return false;
  }
}

function loadTabUrl(tab, value) {
  const nextUrl = normalizeStoredUrl(value);
  tab.url = nextUrl;
  tab.error = "";
  tab.loading = true;
  tab.unreadCount = null;
  tab.hasSeenTitle = false;
  tab.title = nextUrl === NEW_TAB_URL ? "New Tab" : new URL(nextUrl).hostname;
  persistState();
  sendState();

  const load = nextUrl === NEW_TAB_URL
    ? tab.view.webContents.loadFile(START_FILE)
    : tab.view.webContents.loadURL(nextUrl);
  load.catch((error) => {
    if (tab.view.webContents.isDestroyed()) return;
    tab.loading = false;
    tab.error = error.message || "Could not load this page.";
    sendState();
  });
}

function openMailto(value) {
  if (!/^mailto:/i.test(String(value))) return false;
  shell.openExternal(value).catch((error) => console.warn("Could not open mail link:", error.message));
  return true;
}

function navigateTab(tab, input) {
  const raw = String(input ?? "").trim();
  if (/^mailto:/i.test(raw)) return openMailto(raw);
  let nextUrl;
  try {
    nextUrl = normalizeAddress(raw);
  } catch (error) {
    dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "Can't open address",
      message: error.message
    });
    return false;
  }
  loadTabUrl(tab, nextUrl);
  return true;
}

function createTab(url = NEW_TAB_URL, activate = true, restored = null) {
  if (tabs.length >= MAX_TABS) {
    startNotification("Devil Browser", "Close a tab before opening another one.", "tab-limit");
    return null;
  }
  const id = restored?.id || randomUUID();
  const view = new WebContentsView({
    webPreferences: {
      partition: PARTITION,
      preload: undefined,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false
    }
  });
  const initialUrl = normalizeStoredUrl(url);
  const tab = {
    id,
    url: initialUrl,
    title: restored?.title || (initialUrl === NEW_TAB_URL ? "New Tab" : new URL(initialUrl).hostname),
    unreadCount: restored?.unreadCount ?? null,
    hasSeenTitle: Boolean(restored && restored.title && restored.title !== "New Tab"),
    loading: false,
    error: "",
    view
  };
  tabs.push(tab);
  if (mainWindow) mainWindow.contentView.addChildView(view);
  view.setVisible(false);

  const contents = view.webContents;
  contents.setWindowOpenHandler(({ url: popupUrl }) => {
    if (isWebUrl(popupUrl)) createTab(popupUrl, true);
    else if (/^mailto:/i.test(popupUrl)) openMailto(popupUrl);
    return { action: "deny" };
  });

  contents.on("will-navigate", (event, destination) => {
    if (isWebUrl(destination) || isStartFile(destination)) return;
    event.preventDefault();
    if (/^mailto:/i.test(destination)) openMailto(destination);
  });

  contents.on("did-start-loading", () => {
    tab.loading = true;
    tab.error = "";
    sendState();
  });

  contents.on("did-stop-loading", () => {
    tab.loading = false;
    sendState();
  });

  contents.on("did-navigate", (_event, destination) => {
    if (isStartFile(destination)) {
      tab.url = NEW_TAB_URL;
      tab.title = "New Tab";
      tab.unreadCount = null;
      tab.hasSeenTitle = false;
    } else if (isWebUrl(destination)) {
      tab.url = destination;
      tab.error = "";
      addHistoryEntry(destination, tab.title);
    }
    persistState();
    setWindowTitle();
    sendState();
  });

  contents.on("did-navigate-in-page", (_event, destination) => {
    if (!isWebUrl(destination)) return;
    tab.url = destination;
    persistState();
    sendState();
  });

  contents.on("page-title-updated", (event, title) => {
    event.preventDefault();
    const nextTitle = String(title || "Untitled").slice(0, 240);
    const previousCount = tab.unreadCount;
    const nextCount = extractUnreadCount(nextTitle);
    tab.title = nextTitle;
    if (nextCount !== null) {
      if (tab.hasSeenTitle && previousCount !== null && nextCount > previousCount) {
        startNotification(nextTitle, nextCount + " unread message" + (nextCount === 1 ? "" : "s"), "unread-" + tab.id);
      }
      tab.unreadCount = nextCount;
    } else {
      tab.unreadCount = null;
    }
    tab.hasSeenTitle = true;
    if (tab.url && isWebUrl(tab.url)) addHistoryEntry(tab.url, tab.title);
    setWindowTitle();
    persistState();
    sendState();
  });

  contents.on("did-fail-load", (_event, errorCode, description, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3 || isStartFile(validatedURL)) return;
    tab.loading = false;
    tab.error = description || "This page failed to load.";
    sendState();
  });

  contents.on("context-menu", (_event, params) => showPageContextMenu(tab, params));
  contents.on("render-process-gone", (_event, details) => {
    tab.loading = false;
    tab.error = "The page process stopped (" + details.reason + "). Reload this tab.";
    sendState();
  });

  if (mainWindow) layoutViews();
  loadTabUrl(tab, initialUrl);
  if (activate) setActiveTab(id);
  else sendState();
  return tab;
}

function showPageContextMenu(tab, params) {
  if (!mainWindow) return;
  const template = [
    { label: "Back", enabled: tab.view.webContents.canGoBack(), click: () => tab.view.webContents.goBack() },
    { label: "Forward", enabled: tab.view.webContents.canGoForward(), click: () => tab.view.webContents.goForward() },
    { label: "Reload", click: () => tab.view.webContents.reload() },
    { type: "separator" },
    ...(params.linkURL && isWebUrl(params.linkURL) ? [
      { label: "Open link in new tab", click: () => createTab(params.linkURL, true) },
      { label: "Copy link address", click: () => clipboard.writeText(params.linkURL) }
    ] : []),
    ...(params.selectionText ? [
      { label: "Copy selection", click: () => clipboard.writeText(params.selectionText) }
    ] : []),
    { type: "separator" },
    { label: "View source / developer tools", click: () => tab.view.webContents.openDevTools({ mode: "detach" }) }
  ];
  Menu.buildFromTemplate(template).popup({ window: mainWindow });
}

function closeTab(id) {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return false;
  const [removed] = tabs.splice(index, 1);
  if (mainWindow) {
    try { mainWindow.contentView.removeChildView(removed.view); } catch {}
  }
  if (!removed.view.webContents.isDestroyed()) removed.view.webContents.close();
  if (activeTabId === id) {
    const next = tabs[Math.min(index, tabs.length - 1)] || tabs[tabs.length - 1];
    activeTabId = next?.id ?? null;
  }
  if (tabs.length === 0) createTab(NEW_TAB_URL, true);
  else setActiveTab(activeTabId);
  persistState();
  sendState();
  return true;
}

function registerPermissions() {
  browserSession.setPermissionCheckHandler((_contents, permission, requestingOrigin) => {
    return permissionGrants.has(String(requestingOrigin) + "|" + permission);
  });
  browserSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    const requestingUrl = details?.requestingUrl || contents.getURL();
    if (!isWebUrl(requestingUrl)) return callback(false);
    const origin = new URL(requestingUrl).origin;
    const key = origin + "|" + permission;
    if (permissionGrants.has(key)) return callback(true);

    const allowedPermissions = new Set([
      "notifications", "media", "geolocation", "clipboard-read",
      "clipboard-sanitized-write", "midi", "midi-sysex", "pointerLock"
    ]);
    if (!allowedPermissions.has(permission)) return callback(false);
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: "question",
      title: "Website permission",
      message: new URL(origin).hostname + " wants permission",
      detail: "Requested permission: " + permission + ". Devil Browser blocks unrecognized permission types.",
      buttons: ["Allow", "Block"],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    });
    if (choice === 0) permissionGrants.add(key);
    callback(choice === 0);
  });
}

function registerDownloads() {
  browserSession.on("will-download", (_event, item) => {
    const id = randomUUID();
    const download = {
      id,
      url: item.getURL(),
      filename: item.getFilename().slice(0, 240),
      state: "downloading",
      receivedBytes: 0,
      totalBytes: item.getTotalBytes(),
      savePath: ""
    };
    downloads.unshift(download);
    downloads = downloads.slice(0, 100);
    downloadItems.set(id, item);
    item.setSaveDialogOptions({ title: "Save download", defaultPath: download.filename });

    item.on("updated", (_updateEvent, state) => {
      download.state = state === "interrupted" ? "interrupted" : "downloading";
      download.receivedBytes = item.getReceivedBytes();
      download.totalBytes = item.getTotalBytes();
      sendState();
    });

    item.once("done", (_doneEvent, state) => {
      download.state = state;
      download.receivedBytes = item.getReceivedBytes();
      download.totalBytes = item.getTotalBytes();
      download.savePath = item.getSavePath();
      downloadItems.delete(id);
      if (state === "completed") {
        startNotification("Download complete", download.filename, "download-" + id);
      }
      sendState();
    });
    sendState();
  });
}

function assertChromeSender(event) {
  if (!chromeView || chromeView.webContents.isDestroyed() || event.sender.id !== chromeView.webContents.id) {
    throw new Error("This browser action is not available to page content.");
  }
}

function registerIpc() {
  ipcMain.handle("browser:get-state", (event) => {
    assertChromeSender(event);
    return publicState();
  });
  ipcMain.handle("browser:create-tab", (event, url = NEW_TAB_URL) => {
    assertChromeSender(event);
    const tab = createTab(url, true);
    return Boolean(tab);
  });
  ipcMain.handle("browser:activate-tab", (event, id) => {
    assertChromeSender(event);
    return setActiveTab(String(id));
  });
  ipcMain.handle("browser:close-tab", (event, id) => {
    assertChromeSender(event);
    return closeTab(String(id));
  });
  ipcMain.handle("browser:navigate", (event, id, input) => {
    assertChromeSender(event);
    const tab = getTab(String(id));
    if (!tab) throw new Error("That tab no longer exists.");
    return navigateTab(tab, input);
  });
  ipcMain.handle("browser:back", (event, id) => {
    assertChromeSender(event);
    const tab = getTab(String(id));
    if (tab?.view.webContents.canGoBack()) tab.view.webContents.goBack();
  });
  ipcMain.handle("browser:forward", (event, id) => {
    assertChromeSender(event);
    const tab = getTab(String(id));
    if (tab?.view.webContents.canGoForward()) tab.view.webContents.goForward();
  });
  ipcMain.handle("browser:reload", (event, id) => {
    assertChromeSender(event);
    const tab = getTab(String(id));
    if (tab) tab.view.webContents.reload();
  });
  ipcMain.handle("browser:stop", (event, id) => {
    assertChromeSender(event);
    const tab = getTab(String(id));
    if (tab) tab.view.webContents.stop();
  });
  ipcMain.handle("browser:toggle-bookmark", (event, id) => {
    assertChromeSender(event);
    const tab = getTab(String(id));
    if (!tab || !isWebUrl(tab.url)) return false;
    const index = bookmarks.findIndex((item) => item.url === tab.url);
    if (index >= 0) bookmarks.splice(index, 1);
    else bookmarks.unshift({ title: tab.title || new URL(tab.url).hostname, url: tab.url });
    bookmarks = bookmarks.slice(0, 500);
    persistState();
    sendState();
    return index < 0;
  });
  ipcMain.handle("browser:open-bookmark", (event, url) => {
    assertChromeSender(event);
    const safeUrl = normalizeStoredUrl(url);
    if (safeUrl === NEW_TAB_URL) return false;
    return Boolean(createTab(safeUrl, true));
  });
  ipcMain.handle("browser:open-history", (event, url) => {
    assertChromeSender(event);
    const safeUrl = normalizeStoredUrl(url);
    if (safeUrl === NEW_TAB_URL) return false;
    return Boolean(createTab(safeUrl, true));
  });
  ipcMain.handle("browser:open-mail-service", (event, url) => {
    assertChromeSender(event);
    const service = MAIL_SERVICES.find((item) => item.url === url);
    return service ? Boolean(createTab(service.url, true)) : false;
  });
  ipcMain.handle("browser:clear-data", async (event) => {
    assertChromeSender(event);
    const choice = await dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "Clear browsing data",
      message: "Clear cookies, cache and site storage?",
      detail: "You may be signed out of websites. Bookmarks and history will be retained.",
      buttons: ["Clear data", "Cancel"],
      defaultId: 1,
      cancelId: 1
    });
    if (choice.response !== 0) return false;
    await Promise.all([browserSession.clearStorageData(), browserSession.clearCache()]);
    startNotification("Devil Browser", "Browsing data cleared.", "clear-data");
    return true;
  });
  ipcMain.handle("browser:open-download", (event, id) => {
    assertChromeSender(event);
    const item = downloads.find((download) => download.id === id);
    if (!item || item.state !== "completed" || !item.savePath) return false;
    shell.openPath(item.savePath).catch((error) => console.warn(error.message));
    return true;
  });
  ipcMain.handle("browser:cancel-download", (event, id) => {
    assertChromeSender(event);
    const item = downloadItems.get(id);
    if (item) item.cancel();
    return Boolean(item);
  });
}

function installApplicationMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        { label: "New Tab", accelerator: "CommandOrControl+T", click: () => createTab(NEW_TAB_URL, true) },
        { label: "Close Tab", accelerator: "CommandOrControl+W", click: () => closeTab(activeTabId) },
        { type: "separator" },
        { label: "Quit", role: "quit" }
      ]
    },
    {
      label: "Navigate",
      submenu: [
        { label: "Focus Address Bar", accelerator: "CommandOrControl+L", click: focusChromeAddress },
        { label: "Back", accelerator: "Alt+Left", click: () => getTab(activeTabId)?.view.webContents.goBack() },
        { label: "Forward", accelerator: "Alt+Right", click: () => getTab(activeTabId)?.view.webContents.goForward() },
        { label: "Reload", accelerator: "CommandOrControl+R", click: () => getTab(activeTabId)?.view.webContents.reload() }
      ]
    },
    {
      label: "View",
      submenu: [
        { label: "Developer Tools", accelerator: "CommandOrControl+Shift+I", click: () => getTab(activeTabId)?.view.webContents.openDevTools({ mode: "detach" }) },
        { role: "togglefullscreen" }
      ]
    },
    { role: "editMenu" }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BaseWindow({
    width: 1360,
    height: 900,
    minWidth: 760,
    minHeight: 560,
    title: "Devil Browser",
    backgroundColor: "#10131a",
    autoHideMenuBar: true
  });

  chromeView = new WebContentsView({
    webPreferences: {
      preload: PRELOAD_FILE,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });
  mainWindow.contentView.addChildView(chromeView);
  chromeView.webContents.loadFile(CHROME_FILE).catch((error) => console.error("Could not load browser controls:", error));

  mainWindow.on("resize", layoutViews);
  mainWindow.on("closed", () => {
    for (const tab of tabs) {
      if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close();
    }
    tabs = [];
    mainWindow = null;
    chromeView = null;
  });

  const saved = readPersistentState();
  bookmarks = saved.bookmarks;
  history = saved.history;
  for (const restored of saved.tabs) createTab(restored.url, false, restored);
  if (tabs.length === 0) createTab(NEW_TAB_URL, true);
  else setActiveTab(saved.activeTabId || tabs[0].id);

  layoutViews();
  setWindowTitle();
}

app.whenReady().then(() => {
  registerPermissions();
  registerDownloads();
  registerIpc();
  registerBrowserMenus({
    ipcMain, Menu, dialog, shell, app, browserSession, permissionGrants,
    getWindow: () => mainWindow,
    getTabs: () => tabs,
    getActiveTab: () => getTab(activeTabId),
    getHistory: () => history,
    getDownloads: () => downloads,
    getDownloadItems: () => downloadItems,
    getTab,
    assertChromeSender,
    createTab,
    closeTab,
    setActiveTab
  });
  installApplicationMenu();
  createWindow();
  app.on("activate", () => {
    if (BaseWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => persistState());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
