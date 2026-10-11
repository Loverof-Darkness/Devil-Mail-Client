import { MAIL_SERVICES, isWebUrl } from "./browser-core.js";

export function registerBrowserMenus(deps) {
  const {
    ipcMain, Menu, dialog, shell, app, browserSession, permissionGrants,
    getWindow, getTabs, getActiveTab, getHistory, getDownloads, getDownloadItems,
    getTab, assertChromeSender, createTab, closeTab, setActiveTab
  } = deps;

  function popup(items) {
    const window = getWindow();
    if (!window) return;
    Menu.buildFromTemplate(items).popup({ window });
  }

  function register(channel, action) {
    ipcMain.handle(channel, (event, ...args) => {
      assertChromeSender(event);
      return action(...args);
    });
  }

  register("browser:show-mail-menu", () => {
    popup(MAIL_SERVICES.map((service) => ({
      label: service.name,
      click: () => createTab(service.url, true)
    })));
  });

  register("browser:show-history-menu", () => {
    const entries = getHistory().slice(0, 18);
    const items = entries.map((entry) => ({
      label: (entry.title || entry.url).slice(0, 70) + "  —  " + new URL(entry.url).hostname,
      click: () => {
        if (isWebUrl(entry.url)) createTab(entry.url, true);
      }
    }));
    if (!items.length) items.push({ label: "No recent history", enabled: false });
    items.push({ type: "separator" });
    items.push({
      label: "Clear browsing data…",
      click: async () => clearData()
    });
    popup(items);
  });

  register("browser:show-downloads-menu", () => {
    const entries = getDownloads().slice(0, 18);
    const items = entries.map((download) => {
      const active = getDownloadItems().has(download.id);
      const suffix = download.state === "completed" ? "Completed" :
        download.state === "interrupted" ? "Interrupted" :
        download.state === "cancelled" ? "Cancelled" : "Downloading";
      return {
        label: (download.filename || "Download").slice(0, 80) + "  —  " + suffix,
        enabled: active || (download.state === "completed" && Boolean(download.savePath)),
        click: () => {
          if (active) {
            const item = getDownloadItems().get(download.id);
            if (item) item.cancel();
          } else if (download.state === "completed" && download.savePath) {
            shell.openPath(download.savePath).catch((error) => console.warn(error.message));
          }
        }
      };
    });
    if (!items.length) items.push({ label: "No downloads yet", enabled: false });
    items.push({ type: "separator" });
    items.push({ label: "Open Downloads Folder", click: () => shell.openPath(app.getPath("downloads")) });
    popup(items);
  });

  register("browser:show-tab-menu", (id) => {
    const tab = getTab(String(id));
    if (!tab) return;
    popup([
      { label: "Activate tab", click: () => setActiveTab(tab.id) },
      { label: "Duplicate tab", click: () => createTab(tab.url, true) },
      { type: "separator" },
      { label: "Close tab", click: () => closeTab(tab.id) },
      {
        label: "Close other tabs",
        enabled: getTabs().length > 1,
        click: () => {
          for (const other of getTabs().slice()) {
            if (other.id !== tab.id) closeTab(other.id);
          }
          setActiveTab(tab.id);
        }
      }
    ]);
  });

  register("browser:show-browser-menu", () => {
    const tab = getActiveTab();
    popup([
      { label: "New Tab", accelerator: "CommandOrControl+T", click: () => createTab("devil://newtab", true) },
      { label: "New Mail Tab", submenu: MAIL_SERVICES.map((service) => ({
        label: service.name,
        click: () => createTab(service.url, true)
      })) },
      { type: "separator" },
      { label: "Zoom In", accelerator: "CommandOrControl+Plus", click: () => tab?.view.webContents.setZoomLevel(tab.view.webContents.getZoomLevel() + 1) },
      { label: "Zoom Out", accelerator: "CommandOrControl+-", click: () => tab?.view.webContents.setZoomLevel(tab.view.webContents.getZoomLevel() - 1) },
      { label: "Reset Zoom", accelerator: "CommandOrControl+0", click: () => tab?.view.webContents.setZoomLevel(0) },
      { label: "Developer Tools", accelerator: "CommandOrControl+Shift+I", click: () => tab?.view.webContents.openDevTools({ mode: "detach" }) },
      { type: "separator" },
      { label: "Clear browsing data…", click: () => clearData() },
      { label: "Quit Devil Browser", click: () => app.quit() }
    ]);
  });

  async function clearData() {
    const window = getWindow();
    if (!window) return;
    const choice = await dialog.showMessageBox(window, {
      type: "warning",
      title: "Clear browsing data",
      message: "Clear cookies, cache and site storage?",
      detail: "You may be signed out of websites. Bookmarks and history will be retained.",
      buttons: ["Clear data", "Cancel"],
      defaultId: 1,
      cancelId: 1
    });
    if (choice.response !== 0) return;
    await Promise.all([browserSession.clearStorageData(), browserSession.clearCache()]);
    permissionGrants.clear();
    dialog.showMessageBox(window, {
      type: "info",
      title: "Browsing data cleared",
      message: "Cookies, cache and site storage were cleared."
    });
  }
}
