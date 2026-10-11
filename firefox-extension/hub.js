import {
  SAVED_ORIGINS_KEY,
  normalizeHttpsAddress,
  sanitizeSavedOrigins
} from "./core.js";

const statusElement = document.querySelector("#status");
const recentSitesElement = document.querySelector("#recent-sites");
const customForm = document.querySelector("#custom-form");
const customInput = document.querySelector("#custom-url");

function showStatus(message, state = "neutral") {
  statusElement.textContent = message;
  statusElement.dataset.state = state;
}

async function openWebsite(url, label) {
  showStatus("Opening " + label + " in a new tab…");
  try {
    const response = await browser.runtime.sendMessage({
      type: "devil-mail/open-site",
      url
    });
    if (!response?.ok) {
      throw new Error(response?.error || "Firefox could not open that website.");
    }
    showStatus("Opened " + label + ". Firefox will handle its sign-in session.", "success");
  } catch (error) {
    showStatus(error.message || "Something went wrong. Please try again.", "error");
  }
}

document.querySelectorAll("[data-url]").forEach((button) => {
  button.addEventListener("click", () => {
    void openWebsite(button.dataset.url, button.dataset.label || button.dataset.url);
  });
});

customForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const website = normalizeHttpsAddress(customInput.value);
    void openWebsite(website.url, website.hostname);
    customInput.value = "";
  } catch (error) {
    showStatus(error.message, "error");
    customInput.focus();
  }
});

function renderRecentSites(values) {
  const origins = sanitizeSavedOrigins(values);
  recentSitesElement.replaceChildren();

  if (origins.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Your recently opened email websites will appear here.";
    recentSitesElement.append(empty);
    return;
  }

  for (const origin of origins) {
    const hostname = new URL(origin).hostname;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recent-site";
    button.setAttribute("aria-label", "Open " + hostname);

    const mark = document.createElement("span");
    mark.className = "recent-mark";
    mark.textContent = hostname.slice(0, 1).toUpperCase();

    const copy = document.createElement("span");
    copy.className = "recent-copy";
    const title = document.createElement("strong");
    title.textContent = hostname;
    const subtitle = document.createElement("small");
    subtitle.textContent = origin;
    copy.append(title, subtitle);

    const arrow = document.createElement("span");
    arrow.className = "launch-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";

    button.append(mark, copy, arrow);
    button.addEventListener("click", () => {
      void openWebsite(origin, hostname);
    });
    recentSitesElement.append(button);
  }
}

async function loadRecentSites() {
  try {
    const stored = await browser.storage.local.get(SAVED_ORIGINS_KEY);
    renderRecentSites(stored[SAVED_ORIGINS_KEY]);
  } catch {
    showStatus("Could not load saved websites. Try reopening the extension.", "error");
  }
}

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[SAVED_ORIGINS_KEY]) {
    renderRecentSites(changes[SAVED_ORIGINS_KEY].newValue);
  }
});

void loadRecentSites();
