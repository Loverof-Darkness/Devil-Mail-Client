import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeHttpsAddress,
  sanitizeSavedOrigins,
  mergeSavedOrigin,
  SAVED_ORIGINS_LIMIT
} from "../firefox-extension/core.js";

test("normalizes bare custom mail domains to HTTPS", () => {
  assert.deepEqual(normalizeHttpsAddress("mail.example.com/inbox"), {
    url: "https://mail.example.com/inbox",
    origin: "https://mail.example.com",
    hostname: "mail.example.com"
  });
});

test("preserves a website path for immediate navigation", () => {
  const website = normalizeHttpsAddress("https://mail.example.com/work/inbox?view=unread#top");
  assert.equal(website.url, "https://mail.example.com/work/inbox?view=unread#top");
  assert.equal(website.origin, "https://mail.example.com");
});

test("rejects insecure protocols and non-web schemes", () => {
  assert.throws(() => normalizeHttpsAddress("http://mail.example.com"), /HTTPS websites only/);
  assert.throws(() => normalizeHttpsAddress("javascript:alert(1)"), /HTTPS websites only/);
  assert.throws(() => normalizeHttpsAddress("file:///tmp/mail.html"), /HTTPS websites only/);
});

test("rejects URLs that include embedded usernames or passwords", () => {
  assert.throws(() => normalizeHttpsAddress("https://user:secret@mail.example.com"), /embedded usernames or passwords/);
});

test("saved entries keep only HTTPS origins and strip path, query, and fragment", () => {
  assert.deepEqual(sanitizeSavedOrigins([
    "https://mail.example.com/folder?token=never-store#inbox",
    "http://insecure.example.com",
    "javascript:alert(1)",
    "https://mail.example.com/other",
    "https://work.example.org/sign-in?state=private"
  ]), [
    "https://mail.example.com",
    "https://work.example.org"
  ]);
});

test("new origins are moved to the front, de-duplicated, and capped", () => {
  const existing = Array.from({ length: SAVED_ORIGINS_LIMIT }, (_, index) => "https://mail" + index + ".example.com/path");
  const merged = mergeSavedOrigin(existing, "https://mail5.example.com/another-folder?token=not-saved");
  assert.equal(merged[0], "https://mail5.example.com");
  assert.equal(merged.filter((origin) => origin === "https://mail5.example.com").length, 1);
  assert.equal(merged.length, SAVED_ORIGINS_LIMIT);
  assert.equal(merged.includes("https://mail11.example.com"), false);
});
