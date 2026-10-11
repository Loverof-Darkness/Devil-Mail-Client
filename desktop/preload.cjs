const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("devilBrowser", Object.freeze({
  getState: () => ipcRenderer.invoke("browser:get-state"),
  createTab: (url) => ipcRenderer.invoke("browser:create-tab", url),
  activateTab: (id) => ipcRenderer.invoke("browser:activate-tab", id),
  closeTab: (id) => ipcRenderer.invoke("browser:close-tab", id),
  navigate: (id, value) => ipcRenderer.invoke("browser:navigate", id, value),
  back: (id) => ipcRenderer.invoke("browser:back", id),
  forward: (id) => ipcRenderer.invoke("browser:forward", id),
  reload: (id) => ipcRenderer.invoke("browser:reload", id),
  stop: (id) => ipcRenderer.invoke("browser:stop", id),
  toggleBookmark: (id) => ipcRenderer.invoke("browser:toggle-bookmark", id),
  openBookmark: (url) => ipcRenderer.invoke("browser:open-bookmark", url),
  openHistory: (url) => ipcRenderer.invoke("browser:open-history", url),
  openMailService: (url) => ipcRenderer.invoke("browser:open-mail-service", url),
  clearBrowsingData: () => ipcRenderer.invoke("browser:clear-data"),
  openDownload: (id) => ipcRenderer.invoke("browser:open-download", id),
  cancelDownload: (id) => ipcRenderer.invoke("browser:cancel-download", id),
  showMailMenu: () => ipcRenderer.invoke("browser:show-mail-menu"),
  showHistoryMenu: () => ipcRenderer.invoke("browser:show-history-menu"),
  showDownloadsMenu: () => ipcRenderer.invoke("browser:show-downloads-menu"),
  showTabMenu: (id) => ipcRenderer.invoke("browser:show-tab-menu", id),
  showBrowserMenu: () => ipcRenderer.invoke("browser:show-browser-menu"),
  onState: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("browser:state", listener);
    return () => ipcRenderer.removeListener("browser:state", listener);
  },
  onFocusAddress: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = () => callback();
    ipcRenderer.on("browser:focus-address", listener);
    return () => ipcRenderer.removeListener("browser:focus-address", listener);
  }
}));
