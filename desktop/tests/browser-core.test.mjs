import test from "node:test";
import assert from "node:assert/strict";
import {
  NEW_TAB_URL, normalizeAddress, normalizeStoredUrl, isWebUrl,
  extractUnreadCount, sanitizePersistedState
} from "../browser-core.js";

test("normalizes website addresses and local development hosts", () => {
  assert.equal(normalizeAddress("https://example.com"), "https://example.com/");
  assert.equal(normalizeAddress("example.com/path"), "https://example.com/path");
  assert.equal(normalizeAddress("localhost:3000"), "http://localhost:3000/");
});

test("treats plain text as a search query", () => {
  assert.equal(normalizeAddress("hello world"), "https://duckduckgo.com/?q=hello%20world");
});

test("blocks unsafe protocols and embedded credentials", () => {
  assert.throws(() => normalizeAddress("javascript:alert(1)"), /only HTTP and HTTPS/);
  assert.throws(() => normalizeAddress("file:///etc/passwd"), /only HTTP and HTTPS/);
  assert.throws(() => normalizeAddress("https://user:pass@example.com"), /not valid/);
  assert.equal(isWebUrl("https://example.com"), true);
  assert.equal(isWebUrl("file:///etc/passwd"), false);
});

test("preserves the internal new-tab sentinel only", () => {
  assert.equal(normalizeStoredUrl(NEW_TAB_URL), NEW_TAB_URL);
  assert.equal(normalizeStoredUrl("file:///etc/passwd"), NEW_TAB_URL);
});

test("extracts supported unread-count title formats only", () => {
  assert.equal(extractUnreadCount("(12) Inbox - Gmail"), 12);
  assert.equal(extractUnreadCount("[4] Mail"), 4);
  assert.equal(extractUnreadCount("3 unread messages"), 3);
  assert.equal(extractUnreadCount("Inbox (12) - Gmail"), null);
  assert.equal(extractUnreadCount("2026 - Home"), null);
});

test("sanitizes restored tabs, bookmarks, history, and active selection", () => {
  const state = sanitizePersistedState({
    tabs: [
      { id: "a", url: "https://example.com", title: "Example", unreadCount: 2 },
      { id: "b", url: "file:///etc/passwd", title: "Bad", unreadCount: -3 }
    ],
    activeTabId: "b",
    bookmarks: [
      { title: "Example", url: "https://example.com" },
      { title: "Local file", url: "file:///tmp/private" }
    ],
    history: [{ title: "Example", url: "https://example.com", visitedAt: 123 }]
  });
  assert.equal(state.tabs[1].url, NEW_TAB_URL);
  assert.equal(state.tabs[1].unreadCount, null);
  assert.equal(state.activeTabId, "b");
  assert.equal(state.bookmarks.length, 1);
  assert.equal(state.history.length, 1);
});
