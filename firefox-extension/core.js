export const WINDOW_ID_KEY = "devilMailWindowId";
export const SAVED_ORIGINS_KEY = "devilMailSavedOrigins";
export const SAVED_ORIGINS_LIMIT = 12;

export const MAIL_PROVIDERS = Object.freeze([
  { name: "Gmail", url: "https://mail.google.com/", mark: "G", className: "gmail" },
  { name: "Outlook", url: "https://outlook.live.com/mail/", mark: "O", className: "outlook" },
  { name: "Yahoo Mail", url: "https://mail.yahoo.com/", mark: "Y!", className: "yahoo" },
  { name: "Zoho Mail", url: "https://mail.zoho.com/", mark: "Z", className: "zoho" },
  { name: "Proton Mail", url: "https://mail.proton.me/", mark: "P", className: "proton" },
  { name: "Fastmail", url: "https://app.fastmail.com/", mark: "F", className: "fastmail" }
]);

export function normalizeHttpsAddress(input) {
  let value = String(input ?? "").trim();
  if (!value) {
    throw new Error("Enter an email website address.");
  }
  if (value.length > 2048) {
    throw new Error("The address is too long.");
  }

  // Treat a bare domain as HTTPS, but never upgrade an explicitly insecure URL silently.
  if (!/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)) {
    value = "https://" + value;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Enter a valid website address.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("For safety, Devil Mail opens HTTPS websites only.");
  }
  if (!parsed.hostname || parsed.username || parsed.password) {
    throw new Error("Addresses with embedded usernames or passwords are not allowed.");
  }

  return {
    url: parsed.href,
    origin: parsed.origin,
    hostname: parsed.hostname
  };
}

export function sanitizeSavedOrigins(values, limit = SAVED_ORIGINS_LIMIT) {
  const result = [];
  const maximum = Number.isInteger(limit) && limit > 0 ? limit : SAVED_ORIGINS_LIMIT;
  if (!Array.isArray(values)) {
    return result;
  }

  for (const value of values) {
    try {
      const candidate = typeof value === "string" ? value : value?.origin;
      const normalized = normalizeHttpsAddress(candidate);
      if (!result.includes(normalized.origin)) {
        result.push(normalized.origin);
      }
      if (result.length >= maximum) {
        break;
      }
    } catch {
      // Ignore corrupted, stale, or unsafe stored entries.
    }
  }
  return result;
}

export function mergeSavedOrigin(values, address, limit = SAVED_ORIGINS_LIMIT) {
  const normalized = normalizeHttpsAddress(address);
  return sanitizeSavedOrigins([normalized.origin, ...(Array.isArray(values) ? values : [])], limit);
}
