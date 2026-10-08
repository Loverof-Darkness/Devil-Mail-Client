import assert from "node:assert/strict";
import test from "node:test";
import { normalizeUrl } from "../core/url.js";
import { parseStatus } from "../core/monitor.js";

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
