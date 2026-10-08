import { loadState, saveState, exportState, importState, clearState } from "./core/storage.js";
import { normalizeUrl } from "./core/url.js";
import { MailMonitorManager } from "./core/monitor.js";

const state = loadState();
const els = {
  mailList: document.querySelector("#mailList"),
  tabStrip: document.querySelector("#tabStrip"),
  emptyHint: document.querySelector("#emptyHint"),
  monitorSummary: document.querySelector("#monitorSummary"),
  addressForm: document.querySelector("#addressForm"),
  addressInput: document.querySelector("#addressInput"),
  browserNotice: document.querySelector("#browserNotice"),
  welcome: document.querySelector("#welcome"),
  frameShell: document.querySelector("#frameShell"),
  mailFrame: document.querySelector("#mailFrame"),
  frameFallback: document.querySelector("#frameFallback"),
  mailDialog: document.querySelector("#mailDialog"),
  mailForm: document.querySelector("#mailForm"),
  mailName: document.querySelector("#mailName"),
  mailUrl: document.querySelector("#mailUrl"),
  monitorUrl: document.querySelector("#monitorUrl"),
  monitorInterval: document.querySelector("#monitorInterval"),
  mailFormError: document.querySelector("#mailFormError"),
  settingsDialog: document.querySelector("#settingsDialog"),
  notificationStatus: document.querySelector("#notificationStatus"),
  toast: document.querySelector("#toast"),
  mailPreset: document.querySelector("#mailPreset")
};

let toastTimer;
let frameTimer;
let previousFrameUrl = "";

function activeTab() {
  return state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
}

function persist() {
  saveState(state);
  renderSidebar();
  renderTabs();
  renderToolbar();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("visible"), 3200);
}

function createTab(payload) {
  const url = normalizeUrl(payload.url);
  return {
    id: crypto.randomUUID(),
    name: payload.name.trim().slice(0, 40),
    url,
    icon: "✉",
    history: [url],
    historyIndex: 0,
    unreadCount: 0,
    latestMessageId: "",
    latestSubject: "",
    latestFrom: "",
    lastCheckedAt: 0,
    monitorError: "",
    monitorUrl: payload.monitorUrl ? normalizeUrl(payload.monitorUrl) : "",
    monitorInterval: Number(payload.monitorInterval) || 60000
  };
}

function setActiveTab(id) {
  if (!state.tabs.some((tab) => tab.id === id)) return;
  state.activeTabId = id;
  persist();
  loadActiveFrame();
}

function openMailDialog() {
  els.mailForm.reset();
  els.mailPreset.value = "custom";
  els.monitorInterval.value = "60000";
  els.mailFormError.hidden = true;
  els.mailFormError.textContent = "";
  if (typeof els.mailDialog.showModal === "function") {
    els.mailDialog.showModal();
  } else {
    els.mailDialog.setAttribute("open", "");
  }
  queueMicrotask(() => els.mailName.focus());
}

function closeDialog(dialog) {
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

function renderSidebar() {
  els.mailList.replaceChildren();
  els.emptyHint.hidden = state.tabs.length > 0;

  for (let index = 0; index < state.tabs.length; index += 1) {
    const tab = state.tabs[index];
    const item = document.createElement("div");
    item.className = `mail-item${tab.id === state.activeTabId ? " active" : ""}`;

    const main = document.createElement("button");
    main.type = "button";
    main.className = "mail-item-main";
    main.addEventListener("click", () => setActiveTab(tab.id));

    const icon = document.createElement("span");
    icon.className = "mail-item-icon";
    icon.textContent = tab.icon || "✉";

    const body = document.createElement("span");
    body.className = "mail-item-body";

    const name = document.createElement("span");
    name.className = "mail-item-name";
    name.textContent = tab.name;

    const meta = document.createElement("span");
    meta.className = "mail-item-meta";
    if (tab.monitorUrl) {
      meta.textContent = tab.monitorError ? "Monitor error" : "Monitoring on";
    } else {
      try { meta.textContent = new URL(tab.url).hostname; } catch { meta.textContent = "Webmail"; }
    }

    body.append(name, meta);

    const badge = document.createElement("span");
    badge.className = "mail-badge";
    badge.textContent = tab.unreadCount > 99 ? "99+" : String(tab.unreadCount);
    badge.hidden = tab.unreadCount < 1;

    main.append(icon, body, badge);
    main.title = `${tab.name} — ${tab.url}`;
    item.append(main);

    const menuButton = document.createElement("button");
    menuButton.type = "button";
    menuButton.className = "mail-item-menu";
    menuButton.textContent = "⋯";
    menuButton.title = `Actions for ${tab.name}`;
    menuButton.setAttribute("aria-label", `Actions for ${tab.name}`);

    const menu = document.createElement("div");
    menu.className = "mail-menu";
    menu.hidden = true;

    const addAction = (label, handler, disabled = false) => {
      const action = document.createElement("button");
      action.type = "button";
      action.className = "mail-menu-action";
      action.textContent = label;
      action.disabled = disabled;
      action.addEventListener("click", (event) => {
        event.stopPropagation();
        menu.hidden = true;
        handler();
      });
      menu.append(action);
    };

    addAction("Rename", () => editTabName(tab));
    addAction("Open in browser", () => {
      const popup = window.open(tab.url, "_blank", "noopener,noreferrer");
      if (!popup) showToast("The browser blocked the new tab.");
    });
    addAction("Duplicate", () => duplicateTab(tab));
    addAction("Move up", () => moveTab(tab.id, -1), index === 0);
    addAction("Move down", () => moveTab(tab.id, 1), index === state.tabs.length - 1);
    addAction("Delete", () => closeTab(tab.id));

    menuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      document.querySelectorAll(".mail-menu").forEach((candidate) => {
        if (candidate !== menu) candidate.hidden = true;
      });
      menu.hidden = !menu.hidden;
    });

    item.append(menuButton, menu);
    els.mailList.append(item);
  }

  const monitored = state.tabs.filter((tab) => tab.monitorUrl).length;
  els.monitorSummary.textContent = monitored === 0
    ? "No monitors running"
    : `${monitored} monitor${monitored === 1 ? "" : "s"} running`;
}

function editTabName(tab) {
  const next = window.prompt("Tab name", tab.name);
  if (next === null) return;
  const name = next.trim();
  if (!name) {
    showToast("Tab name cannot be empty.");
    return;
  }
  tab.name = name.slice(0, 40);
  persist();
  showToast("Tab renamed.");
}

function duplicateTab(tab) {
  const copy = structuredClone(tab);
  copy.id = crypto.randomUUID();
  copy.name = `${tab.name} copy`.slice(0, 40);
  copy.unreadCount = 0;
  copy.latestMessageId = "";
  copy.latestSubject = "";
  copy.latestFrom = "";
  copy.lastCheckedAt = 0;
  copy.monitorError = "";

  const index = state.tabs.findIndex((candidate) => candidate.id === tab.id);
  state.tabs.splice(index + 1, 0, copy);
  state.activeTabId = copy.id;
  persist();
  loadActiveFrame();
  monitorManager.sync(state.tabs);
  showToast(`${copy.name} added.`);
}

function moveTab(id, offset) {
  const index = state.tabs.findIndex((tab) => tab.id === id);
  const nextIndex = index + offset;
  if (index < 0 || nextIndex < 0 || nextIndex >= state.tabs.length) return;
  [state.tabs[index], state.tabs[nextIndex]] = [state.tabs[nextIndex], state.tabs[index]];
  persist();
}
function renderTabs() {
  els.tabStrip.replaceChildren();

  for (const tab of state.tabs) {
    const tabEl = document.createElement("div");
    tabEl.className = `workspace-tab${tab.id === state.activeTabId ? " active" : ""}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "workspace-tab-main";
    button.addEventListener("click", () => setActiveTab(tab.id));

    const dot = document.createElement("span");
    dot.className = "tab-dot";
    dot.textContent = tab.icon || "✉";

    const title = document.createElement("span");
    title.textContent = tab.name;

    const count = document.createElement("span");
    count.className = "tab-count";
    count.textContent = tab.unreadCount > 99 ? "99+" : String(tab.unreadCount);
    count.hidden = tab.unreadCount < 1;

    button.append(dot, title, count);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "workspace-tab-close";
    close.setAttribute("aria-label", `Close ${tab.name}`);
    close.textContent = "×";
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      closeTab(tab.id);
    });

    tabEl.append(button, close);
    els.tabStrip.append(tabEl);
  }

  const plus = document.createElement("button");
  plus.type = "button";
  plus.className = "tab-add";
  plus.textContent = "＋";
  plus.title = "Add mail";
  plus.setAttribute("aria-label", "Add mail");
  plus.addEventListener("click", openMailDialog);
  els.tabStrip.append(plus);
}

function renderToolbar() {
  const tab = activeTab();
  const hasTab = Boolean(tab);
  document.querySelector("#backButton").disabled = !tab || tab.historyIndex <= 0;
  document.querySelector("#forwardButton").disabled = !tab || tab.historyIndex >= tab.history.length - 1;
  document.querySelector("#reloadButton").disabled = !hasTab;
  document.querySelector("#externalButton").disabled = !hasTab;

  els.addressInput.disabled = !hasTab;
  els.addressInput.value = tab?.url ?? "";
}

function loadActiveFrame() {
  clearTimeout(frameTimer);
  const tab = activeTab();

  if (!tab) {
    els.welcome.hidden = false;
    els.frameShell.hidden = true;
    els.browserNotice.hidden = true;
    els.mailFrame.removeAttribute("src");
    renderToolbar();
    return;
  }

  els.welcome.hidden = true;
  els.frameShell.hidden = false;
  els.frameFallback.hidden = true;
  els.browserNotice.hidden = false;
  els.browserNotice.textContent = "Embedded browsing can be blocked by the mail provider. Use ↗ to open this service in a normal browser tab.";
  renderToolbar();

  const nextUrl = tab.url;
  const shouldReload = previousFrameUrl === nextUrl;
  previousFrameUrl = nextUrl;

  if (shouldReload) {
    els.mailFrame.src = "about:blank";
    requestAnimationFrame(() => { els.mailFrame.src = nextUrl; });
  } else {
    els.mailFrame.src = nextUrl;
  }

  // A blocked frame often never emits a useful error event. We show a
  // fallback after a delay, while a successful load hides it again.
  frameTimer = setTimeout(() => {
    els.frameFallback.hidden = false;
  }, 6500);
}

function updateTabUrl(tab, nextUrl, addHistory = true) {
  const normalized = normalizeUrl(nextUrl);
  tab.url = normalized;

  if (addHistory) {
    tab.history = tab.history.slice(0, tab.historyIndex + 1);
    if (tab.history[tab.history.length - 1] !== normalized) tab.history.push(normalized);
    tab.history = tab.history.slice(-30);
    tab.historyIndex = tab.history.length - 1;
  }

  persist();
  loadActiveFrame();
}

function navigateHistory(direction) {
  const tab = activeTab();
  if (!tab) return;
  const nextIndex = tab.historyIndex + direction;
  if (nextIndex < 0 || nextIndex >= tab.history.length) return;
  tab.historyIndex = nextIndex;
  tab.url = tab.history[nextIndex];
  persist();
  loadActiveFrame();
}

function closeTab(id) {
  const index = state.tabs.findIndex((tab) => tab.id === id);
  if (index === -1) return;

  const wasActive = state.activeTabId === id;
  state.tabs.splice(index, 1);

  if (wasActive) {
    const next = state.tabs[index] ?? state.tabs[index - 1] ?? state.tabs[0] ?? null;
    state.activeTabId = next?.id ?? null;
  }

  persist();
  loadActiveFrame();
  monitorManager.sync(state.tabs);
}

function editTab(tab) {
  const nextName = window.prompt("Tab name", tab.name);
  if (nextName === null) return;
  const name = nextName.trim();
  if (!name) {
    showToast("Tab name cannot be empty.");
    return;
  }
  tab.name = name.slice(0, 40);

  const maybeUrl = window.prompt("Mail website URL", tab.url);
  if (maybeUrl === null) {
    persist();
    return;
  }

  try {
    updateTabUrl(tab, maybeUrl, false);
    tab.history = [tab.url];
    tab.historyIndex = 0;
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Invalid URL.");
    return;
  }

  const monitor = window.prompt("Monitor JSON URL (leave blank to disable monitoring)", tab.monitorUrl || "");
  if (monitor !== null) {
    try {
      tab.monitorUrl = monitor.trim() ? normalizeUrl(monitor.trim()) : "";
      tab.monitorError = "";
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Invalid monitor URL.");
    }
  }

  persist();
  loadActiveFrame();
  monitorManager.sync(state.tabs);
  showToast("Mail tab updated.");
}

async function requestNotifications() {
  if (!("Notification" in window)) {
    showToast("This browser does not support notifications.");
    return false;
  }

  const result = await Notification.requestPermission();
  updateNotificationStatus();
  if (result === "granted") {
    showToast("Desktop notifications enabled.");
    return true;
  }
  showToast("Notifications were not enabled.");
  return false;
}

async function sendNewMailNotification(tab) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const body = tab.latestSubject
    ? `${tab.latestFrom ? `${tab.latestFrom}: ` : ""}${tab.latestSubject}`
    : `${tab.unreadCount} unread message${tab.unreadCount === 1 ? "" : "s"}`;

  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration?.showNotification) {
      await registration.showNotification(`${tab.name} · New mail`, {
        body,
        tag: `devil-mail-${tab.id}`,
        renotify: true,
        icon: "./icon.svg"
      });
    } else {
      new Notification(`${tab.name} · New mail`, { body });
    }
  } catch {
    // Notification failures should not break mail monitoring.
  }
}

function updateNotificationStatus() {
  const supported = "Notification" in window;
  const permission = supported ? Notification.permission : "unsupported";
  els.notificationStatus.textContent =
    permission === "granted" ? "Enabled" :
    permission === "denied" ? "Blocked in browser settings" :
    permission === "unsupported" ? "Not supported by this browser" :
    "Not enabled";
  document.querySelector("#notifyButton").disabled = !supported;
  document.querySelector("#settingsNotifyButton").textContent =
    permission === "granted" ? "Enabled" : "Enable";
}

function handleMonitorUpdate(updatedTab) {
  const current = state.tabs.find((tab) => tab.id === updatedTab.id);
  if (!current) return;
  Object.assign(current, updatedTab);
  persist();
}

const MAIL_PRESETS = {
  custom: { name: "", url: "" },
  gmail: { name: "Gmail", url: "https://mail.google.com/" },
  outlook: { name: "Outlook", url: "https://outlook.live.com/mail/" },
  yahoo: { name: "Yahoo Mail", url: "https://mail.yahoo.com/" },
  zoho: { name: "Zoho Mail", url: "https://mail.zoho.com/" },
  proton: { name: "Proton Mail", url: "https://mail.proton.me/" },
  fastmail: { name: "Fastmail", url: "https://app.fastmail.com/" }
};

function applyMailPreset(value) {
  const preset = MAIL_PRESETS[value] || MAIL_PRESETS.custom;
  if (!preset.url) return;
  els.mailName.value = preset.name;
  els.mailUrl.value = preset.url;
}

function handleAddMail(event) {
  event.preventDefault();
  els.mailFormError.hidden = true;

  try {
    const tab = createTab({
      name: els.mailName.value,
      url: els.mailUrl.value,
      monitorUrl: els.monitorUrl.value,
      monitorInterval: els.monitorInterval.value
    });

    if (!tab.name) throw new Error("Tab name is required.");

    state.tabs.push(tab);
    state.activeTabId = tab.id;
    persist();
    monitorManager.sync(state.tabs);
    closeDialog(els.mailDialog);
    loadActiveFrame();
    showToast(`${tab.name} added.`);
  } catch (error) {
    els.mailFormError.hidden = false;
    els.mailFormError.textContent = error instanceof Error ? error.message : "Could not add mail tab.";
  }
}

function exportWorkspace() {
  const blob = new Blob([exportState(state)], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `devil-mail-workspace-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
  showToast("Workspace exported.");
}

async function importWorkspace(file) {
  const text = await file.text();
  const imported = importState(text);
  state.tabs = imported.tabs;
  state.activeTabId = imported.activeTabId;
  persist();
  monitorManager.sync(state.tabs);
  loadActiveFrame();
  showToast(`${state.tabs.length} tab${state.tabs.length === 1 ? "" : "s"} imported.`);
}

function resetWorkspace() {
  const okay = window.confirm("Reset Devil Mail Client on this browser? This cannot be undone.");
  if (!okay) return;

  monitorManager.stopAll();
  clearState();
  state.tabs = [];
  state.activeTabId = null;
  persist();
  loadActiveFrame();
  showToast("Workspace reset.");
}

const monitorManager = new MailMonitorManager({
  onUpdate: (tab) => handleMonitorUpdate(tab),
  onNewMail: (tab) => sendNewMailNotification(tab)
});

document.querySelector("#addMailButton").addEventListener("click", openMailDialog);
els.mailPreset.addEventListener("change", () => applyMailPreset(els.mailPreset.value));
document.querySelector("#welcomeAddButton").addEventListener("click", openMailDialog);
document.querySelector("#newTabButton").addEventListener("click", openMailDialog);
document.querySelector("#closeMailDialog").addEventListener("click", () => closeDialog(els.mailDialog));
document.querySelector("#cancelMail").addEventListener("click", () => closeDialog(els.mailDialog));
els.mailForm.addEventListener("submit", handleAddMail);

document.querySelector("#settingsButton").addEventListener("click", () => {
  updateNotificationStatus();
  if (typeof els.settingsDialog.showModal === "function") els.settingsDialog.showModal();
  else els.settingsDialog.setAttribute("open", "");
});
document.querySelector("#closeSettingsDialog").addEventListener("click", () => closeDialog(els.settingsDialog));
document.querySelector("#notifyButton").addEventListener("click", requestNotifications);
document.querySelector("#settingsNotifyButton").addEventListener("click", requestNotifications);

document.querySelector("#backButton").addEventListener("click", () => navigateHistory(-1));
document.querySelector("#forwardButton").addEventListener("click", () => navigateHistory(1));
document.querySelector("#reloadButton").addEventListener("click", loadActiveFrame);
document.querySelector("#externalButton").addEventListener("click", () => {
  const tab = activeTab();
  if (tab) window.open(tab.url, "_blank", "noopener,noreferrer");
});
document.querySelector("#fallbackExternalButton").addEventListener("click", () => {
  const tab = activeTab();
  if (tab) window.open(tab.url, "_blank", "noopener,noreferrer");
});

els.addressForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const tab = activeTab();
  if (!tab) {
    openMailDialog();
    return;
  }
  try {
    updateTabUrl(tab, els.addressInput.value, true);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Invalid URL.");
    renderToolbar();
  }
});

els.mailFrame.addEventListener("load", () => {
  clearTimeout(frameTimer);
  els.frameFallback.hidden = true;
});

els.mailFrame.addEventListener("error", () => {
  els.frameFallback.hidden = false;
});

els.importInput?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    await importWorkspace(file);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Import failed.");
  } finally {
    event.target.value = "";
  }
});

document.querySelector("#exportButton").addEventListener("click", exportWorkspace);
document.querySelector("#resetButton").addEventListener("click", resetWorkspace);

document.addEventListener("click", () => {
  document.querySelectorAll(".mail-menu").forEach((menu) => { menu.hidden = true; });
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
    const tab = activeTab();
    if (!tab) return;
    event.preventDefault();
    els.addressInput.focus();
    els.addressInput.select();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  for (const tab of state.tabs) {
    if (tab.monitorUrl) monitorManager.checkNow(tab).catch(() => {});
  }
});

navigator.serviceWorker?.register("./sw.js").catch(() => {});

renderSidebar();
renderTabs();
renderToolbar();
loadActiveFrame();
updateNotificationStatus();
monitorManager.sync(state.tabs);
