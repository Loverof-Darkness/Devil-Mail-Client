export const NEW_TAB_URL = "devil://newtab";
export const DEFAULT_HOME = "https://duckduckgo.com/";
export const MAIL_SERVICES = [
  { id: "gmail", name: "Gmail", url: "https://mail.google.com/" },
  { id: "outlook", name: "Outlook", url: "https://outlook.live.com/mail/" },
  { id: "yahoo", name: "Yahoo Mail", url: "https://mail.yahoo.com/" },
  { id: "zoho", name: "Zoho Mail", url: "https://mail.zoho.com/" },
  { id: "proton", name: "Proton Mail", url: "https://mail.proton.me/" },
  { id: "fastmail", name: "Fastmail", url: "https://app.fastmail.com/" }
];

export function isWebUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function normalizeAddress(input) {
  const value = String(input ?? "").trim();
  if (!value) throw new Error("Enter a website address or search term.");
  if (/^devil:\/\/newtab$/i.test(value)) return NEW_TAB_URL;

  if (/^[a-z][a-z\d+.-]*:(?!\d)/i.test(value)) {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error("That address is not valid.");
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("For your safety, only HTTP and HTTPS websites can be opened here.");
    }
    if (!parsed.hostname || parsed.username || parsed.password) {
      throw new Error("This address is not valid.");
    }
    return parsed.href;
  }

  const looksLikeHost = /^(localhost(?::\d+)?|(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?|[a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)+(?:\:\d+)?)(?:\/[^\s]*)?$/i.test(value);
  if (looksLikeHost && !/\s/.test(value)) {
    const protocol = /^localhost(?::|\/|$)/i.test(value) || /^(?:127\.|0\.0\.0\.0)/.test(value) ? "http://" : "https://";
    const candidate = protocol + value;
    if (isWebUrl(candidate)) return new URL(candidate).href;
  }

  return "https://duckduckgo.com/?q=" + encodeURIComponent(value);
}

export function normalizeStoredUrl(value) {
  if (value === NEW_TAB_URL) return NEW_TAB_URL;
  return isWebUrl(value) ? new URL(value).href : NEW_TAB_URL;
}

export function extractUnreadCount(title) {
  const value = String(title ?? "").trim();
  const match = value.match(/^\((\d{1,5})\)\s*/) ||
    value.match(/^\[(\d{1,5})\]\s*/) ||
    value.match(/^(\d{1,5})\s+(?:unread|new messages?)\b/i);
  if (!match) return null;
  const count = Number(match[1]);
  return Number.isSafeInteger(count) ? Math.min(count, 99999) : null;
}

function safeText(value, limit, fallback = "") {
  return typeof value === "string" ? value.slice(0, limit) : fallback;
}

export function sanitizePersistedState(value) {
  const raw = value && typeof value === "object" ? value : {};
  const sourceTabs = Array.isArray(raw.tabs) ? raw.tabs.slice(0, 30) : [];
  const tabs = sourceTabs.map((tab, index) => ({
    id: safeText(tab?.id, 80, "restored-" + index) || "restored-" + index,
    url: normalizeStoredUrl(tab?.url),
    title: safeText(tab?.title, 240, "New Tab") || "New Tab",
    unreadCount: Number.isSafeInteger(tab?.unreadCount) && tab.unreadCount >= 0 ? Math.min(tab.unreadCount, 99999) : null
  }));
  const validTabIds = new Set(tabs.map((tab) => tab.id));
  const activeTabId = validTabIds.has(raw.activeTabId) ? raw.activeTabId : (tabs[0]?.id ?? null);

  const bookmarks = (Array.isArray(raw.bookmarks) ? raw.bookmarks : [])
    .filter((item) => item && isWebUrl(item.url))
    .slice(0, 500)
    .map((item) => ({
      title: safeText(item.title, 160, new URL(item.url).hostname) || new URL(item.url).hostname,
      url: new URL(item.url).href
    }));

  const history = (Array.isArray(raw.history) ? raw.history : [])
    .filter((item) => item && isWebUrl(item.url))
    .slice(0, 500)
    .map((item) => ({
      title: safeText(item.title, 160, new URL(item.url).hostname) || new URL(item.url).hostname,
      url: new URL(item.url).href,
      visitedAt: Number.isFinite(item.visitedAt) ? item.visitedAt : 0
    }));

  return { tabs, activeTabId, bookmarks, history };
}
