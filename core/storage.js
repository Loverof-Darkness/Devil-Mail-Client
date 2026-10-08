import { normalizeUrl } from "./url.js";

const STORAGE_KEY = "devil-mail-client.workspace";
const SCHEMA_VERSION = 2;

const DEFAULT_STATE = {
  schemaVersion: SCHEMA_VERSION,
  activeTabId: null,
  tabs: [],
  settings: {
    googleClientId: "",
    microsoftClientId: ""
  }
};

function cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeProvider(provider) {
  return ["none", "json", "gmail", "outlook"].includes(provider) ? provider : "none";
}

function sanitizeTab(tab) {
  if (!isRecord(tab)) return null;
  if (typeof tab.id !== "string" || !tab.id) return null;
  if (typeof tab.name !== "string" || !tab.name.trim()) return null;
  if (typeof tab.url !== "string") return null;

  let safeUrl;
  try {
    safeUrl = normalizeUrl(tab.url);
  } catch {
    return null;
  }

  const cleanHistory = Array.isArray(tab.history)
    ? tab.history.map((item) => { try { return normalizeUrl(item); } catch { return null; } }).filter(Boolean).slice(-30)
    : [];
  const history = cleanHistory.length ? cleanHistory : [safeUrl];

  const provider = sanitizeProvider(tab.provider);
  const monitorUrl = provider === "json"
    ? (() => { try { return tab.monitorUrl ? normalizeUrl(tab.monitorUrl) : ""; } catch { return ""; } })()
    : "";

  return {
    id: tab.id,
    name: tab.name.trim().slice(0, 40),
    url: safeUrl,
    icon: typeof tab.icon === "string" ? tab.icon.slice(0, 8) : "✉",
    history,
    historyIndex: Number.isInteger(tab.historyIndex)
      ? Math.max(0, Math.min(tab.historyIndex, history.length - 1))
      : history.length - 1,
    provider,
    accountEmail: typeof tab.accountEmail === "string" ? tab.accountEmail.slice(0, 180) : "",
    unreadCount: Number.isFinite(tab.unreadCount) ? Math.max(0, Math.floor(tab.unreadCount)) : 0,
    latestMessageId: typeof tab.latestMessageId === "string" ? tab.latestMessageId.slice(0, 200) : "",
    latestSubject: typeof tab.latestSubject === "string" ? tab.latestSubject.slice(0, 200) : "",
    latestFrom: typeof tab.latestFrom === "string" ? tab.latestFrom.slice(0, 200) : "",
    lastCheckedAt: Number.isFinite(tab.lastCheckedAt) ? tab.lastCheckedAt : 0,
    monitorError: typeof tab.monitorError === "string" ? tab.monitorError.slice(0, 240) : "",
    monitorUrl,
    monitorInterval: [30000, 60000, 300000, 600000].includes(tab.monitorInterval) ? tab.monitorInterval : 60000
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefault();
    const parsed = JSON.parse(raw);
    const tabs = Array.isArray(parsed.tabs) ? parsed.tabs.map(sanitizeTab).filter(Boolean) : [];
    const activeTabId = tabs.some((tab) => tab.id === parsed.activeTabId)
      ? parsed.activeTabId
      : tabs[0]?.id ?? null;

    return {
      schemaVersion: SCHEMA_VERSION,
      activeTabId,
      tabs,
      settings: {
        googleClientId: typeof parsed.settings?.googleClientId === "string" ? parsed.settings.googleClientId.trim() : "",
        microsoftClientId: typeof parsed.settings?.microsoftClientId === "string" ? parsed.settings.microsoftClientId.trim() : ""
      }
    };
  } catch {
    return cloneDefault();
  }
}

export function saveState(state) {
  const cleanTabs = state.tabs.map(sanitizeTab).filter(Boolean);
  const cleanState = {
    schemaVersion: SCHEMA_VERSION,
    activeTabId: cleanTabs.some((tab) => tab.id === state.activeTabId) ? state.activeTabId : cleanTabs[0]?.id ?? null,
    tabs: cleanTabs,
    settings: {
      googleClientId: typeof state.settings?.googleClientId === "string" ? state.settings.googleClientId.trim() : "",
      microsoftClientId: typeof state.settings?.microsoftClientId === "string" ? state.settings.microsoftClientId.trim() : ""
    }
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanState));
}

export function exportState(state) {
  const tabs = state.tabs.map((tab) => {
    const clean = sanitizeTab(tab);
    return clean ? { ...clean, history: undefined, historyIndex: undefined, monitorError: undefined, lastCheckedAt: undefined } : null;
  }).filter(Boolean);

  return JSON.stringify({
    app: "Devil Mail Client",
    exportedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    settings: {
      googleClientId: state.settings?.googleClientId || "",
      microsoftClientId: state.settings?.microsoftClientId || ""
    },
    tabs
  }, null, 2);
}

export function importState(raw) {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!isRecord(parsed) || parsed.app !== "Devil Mail Client" || !Array.isArray(parsed.tabs)) {
    throw new Error("This is not a Devil Mail Client workspace export.");
  }

  const tabs = parsed.tabs.map((tab) => sanitizeTab({
    ...tab,
    id: crypto.randomUUID(),
    history: [tab.url],
    historyIndex: 0,
    unreadCount: 0,
    latestMessageId: "",
    latestSubject: "",
    latestFrom: "",
    lastCheckedAt: 0,
    monitorError: ""
  })).filter(Boolean);

  return {
    schemaVersion: SCHEMA_VERSION,
    activeTabId: tabs[0]?.id ?? null,
    tabs,
    settings: {
      googleClientId: typeof parsed.settings?.googleClientId === "string" ? parsed.settings.googleClientId.trim() : "",
      microsoftClientId: typeof parsed.settings?.microsoftClientId === "string" ? parsed.settings.microsoftClientId.trim() : ""
    }
  };
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}
