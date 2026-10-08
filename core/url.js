export function normalizeUrl(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) throw new Error("URL is required.");

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(candidate);

  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS URLs are allowed.");
  }

  url.username = "";
  url.password = "";

  return url.href;
}

export function safeOrigin(urlValue) {
  try {
    return new URL(urlValue).origin;
  } catch {
    return "";
  }
}
