import assert from "node:assert/strict";
import test from "node:test";
import { normalizeUrl } from "../core/url.js";
import { MailMonitorManager, parseStatus } from "../core/monitor.js";

test("normalizeUrl forces HTTPS when the scheme is omitted", () => {
  assert.equal(normalizeUrl("mail.example.com"), "https://mail.example.com/");
});

test("normalizeUrl strips embedded credentials", () => {
  assert.equal(normalizeUrl("https://user:password@mail.example.com/inbox"), "https://mail.example.com/inbox");
});

test("normalizeUrl rejects non-HTTPS protocols", () => {
  assert.throws(() => normalizeUrl("http://mail.example.com"), /Only HTTPS URLs/);
  assert.throws(() => normalizeUrl("javascript:alert(1)"), /Only HTTPS URLs|Invalid URL/);
});

test("parseStatus supports direct and nested unread fields", () => {
  assert.deepEqual(parseStatus({ unreadCount: 4, latestMessageId: "m1" }), {
    unreadCount: 4,
    latestMessageId: "m1",
    latestSubject: "",
    latestFrom: ""
  });

  assert.deepEqual(parseStatus({ data: { unread: "7", latestMessageId: "m2" } }), {
    unreadCount: 7,
    latestMessageId: "m2",
    latestSubject: "",
    latestFrom: ""
  });
});

test("parseStatus clamps unread counts and ignores invalid values", () => {
  assert.equal(parseStatus({ unreadCount: -8 }).unreadCount, 0);
  assert.equal(parseStatus({ unreadCount: "not-a-number" }).unreadCount, null);
});

test("monitor establishes a baseline before raising a new-mail event", async () => {
  const originalFetch = globalThis.fetch;
  let payload = {
    unreadCount: 1,
    latestMessageId: "m1",
    latestSubject: "First message",
    latestFrom: "sender@example.com"
  };
  const updates = [];
  const newMails = [];

  globalThis.fetch = async () => new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" }
  });

  const manager = new MailMonitorManager({
    onUpdate: (tab, isNew) => updates.push({ tabId: tab.id, isNew }),
    onNewMail: (tab) => newMails.push(tab.latestMessageId)
  });

  const tab = {
    id: "test-tab",
    monitorUrl: "https://status.example.com/mail",
    monitorInterval: 600000,
    unreadCount: 0,
    latestMessageId: "",
    latestSubject: "",
    latestFrom: "",
    lastCheckedAt: 0,
    monitorError: ""
  };

  await manager.checkNow(tab);
  assert.equal(tab.unreadCount, 1);
  assert.deepEqual(newMails, []);

  payload = {
    unreadCount: 2,
    latestMessageId: "m2",
    latestSubject: "Second message",
    latestFrom: "sender@example.com"
  };

  await manager.checkNow(tab);
  assert.equal(tab.unreadCount, 2);
  assert.deepEqual(newMails, ["m2"]);
  assert.equal(updates.at(-1).isNew, true);

  manager.stopAll();
  globalThis.fetch = originalFetch;
});
