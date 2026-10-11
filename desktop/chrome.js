const api = window.devilBrowser;
const $ = (selector) => document.querySelector(selector);
const el = {
  tabStrip: $("#tabStrip"),
  addressForm: $("#addressForm"),
  addressInput: $("#addressInput"),
  back: $("#backButton"),
  forward: $("#forwardButton"),
  reload: $("#reloadButton"),
  home: $("#homeButton"),
  homePage: $("#homePageButton"),
  newTab: $("#newTabButton"),
  bookmark: $("#bookmarkButton"),
  history: $("#historyButton"),
  downloads: $("#downloadsButton"),
  mail: $("#mailButton"),
  menu: $("#menuButton"),
  bookmarks: $("#bookmarksBar"),
  loading: $("#loadingIndicator"),
  secure: $("#secureMark"),
  toast: $("#toast")
};
let state = { tabs: [], activeTabId: null, bookmarks: [], history: [], downloads: [] };
let toastTimer = null;

function activeTab() {
  return state.tabs.find((tab) => tab.id === state.activeTabId) || null;
}

function showToast(message) {
  el.toast.textContent = String(message);
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2800);
}

function button(label, className, title, handler) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  node.textContent = label;
  node.title = title;
  node.addEventListener("click", handler);
  return node;
}

function renderTabs() {
  el.tabStrip.replaceChildren();
  for (const tab of state.tabs) {
    const tabEl = document.createElement("div");
    tabEl.className = "browser-tab" + (tab.id === state.activeTabId ? " active" : "");
    tabEl.setAttribute("role", "tab");
    tabEl.setAttribute("aria-selected", String(tab.id === state.activeTabId));
    tabEl.title = (tab.title || tab.url) + "\n" + tab.url;

    const icon = document.createElement("span");
    icon.className = "tab-icon";
    icon.textContent = tab.loading ? "◌" : (tab.url === "devil://newtab" ? "✦" : "◈");

    const title = document.createElement("span");
    title.className = "tab-title";
    title.textContent = tab.title || "New Tab";

    tabEl.append(icon, title);
    if (tab.unreadCount > 0) {
      const unread = document.createElement("span");
      unread.className = "unread-badge";
      unread.textContent = tab.unreadCount > 99 ? "99+" : String(tab.unreadCount);
      unread.title = "Unread count inferred from the page title";
      tabEl.append(unread);
    }

    const close = button("×", "tab-close", "Close tab", (event) => {
      event.stopPropagation();
      api.closeTab(tab.id);
    });
    tabEl.append(close);
    tabEl.addEventListener("click", () => api.activateTab(tab.id));
    tabEl.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      api.showTabMenu(tab.id);
    });
    el.tabStrip.append(tabEl);
  }
}

function renderBookmarks() {
  el.bookmarks.replaceChildren();
  if (!state.bookmarks.length) {
    const empty = document.createElement("span");
    empty.className = "bookmark-empty";
    empty.textContent = "Your saved sites will appear here";
    el.bookmarks.append(empty);
    return;
  }
  for (const bookmark of state.bookmarks) {
    const item = button(bookmark.title || bookmark.url, "bookmark-item", bookmark.url, () => api.openBookmark(bookmark.url));
    el.bookmarks.append(item);
  }
}

function render() {
  const tab = activeTab();
  renderTabs();
  renderBookmarks();
  el.back.disabled = !tab || !tab.canGoBack;
  el.forward.disabled = !tab || !tab.canGoForward;
  el.reload.textContent = tab && tab.loading ? "×" : "↻";
  el.reload.title = tab && tab.loading ? "Stop loading" : "Reload";
  el.reload.setAttribute("aria-label", el.reload.title);
  el.loading.hidden = !(tab && tab.loading);
  el.bookmark.textContent = tab && tab.isBookmarked ? "★" : "☆";
  el.bookmark.title = tab && tab.isBookmarked ? "Remove bookmark" : "Bookmark this page";
  el.bookmark.disabled = !tab || !/^https?:/.test(tab.url);
  el.addressInput.disabled = !tab;
  if (document.activeElement !== el.addressInput) {
    el.addressInput.value = tab && tab.url !== "devil://newtab" ? tab.url : "";
  }
  el.secure.classList.toggle("secure", Boolean(tab && tab.url.startsWith("https://")));
  if (tab && tab.error) showToast(tab.error);
}

async function run(action) {
  try {
    await action();
  } catch (error) {
    showToast(error && error.message ? error.message : "The browser action failed.");
  }
}

el.addressForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const tab = activeTab();
  if (!tab) return;
  const value = el.addressInput.value;
  run(() => api.navigate(tab.id, value));
  el.addressInput.blur();
});

el.back.addEventListener("click", () => {
  const tab = activeTab();
  if (tab) run(() => api.back(tab.id));
});
el.forward.addEventListener("click", () => {
  const tab = activeTab();
  if (tab) run(() => api.forward(tab.id));
});
el.reload.addEventListener("click", () => {
  const tab = activeTab();
  if (!tab) return;
  run(() => tab.loading ? api.stop(tab.id) : api.reload(tab.id));
});
el.home.addEventListener("click", () => run(() => api.createTab("devil://newtab")));
el.homePage.addEventListener("click", () => {
  const tab = activeTab();
  if (tab) run(() => api.navigate(tab.id, "devil://newtab"));
});
el.newTab.addEventListener("click", () => run(() => api.createTab("devil://newtab")));
el.bookmark.addEventListener("click", () => {
  const tab = activeTab();
  if (tab) run(() => api.toggleBookmark(tab.id));
});
el.history.addEventListener("click", () => run(() => api.showHistoryMenu()));
el.downloads.addEventListener("click", () => run(() => api.showDownloadsMenu()));
el.mail.addEventListener("click", () => run(() => api.showMailMenu()));
el.menu.addEventListener("click", () => run(() => api.showBrowserMenu()));

el.addressInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    el.addressInput.value = activeTab()?.url === "devil://newtab" ? "" : (activeTab()?.url || "");
    el.addressInput.blur();
  }
});

window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
    event.preventDefault();
    el.addressInput.focus();
    el.addressInput.select();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "t") {
    event.preventDefault();
    run(() => api.createTab("devil://newtab"));
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "w") {
    event.preventDefault();
    const tab = activeTab();
    if (tab) run(() => api.closeTab(tab.id));
  }
});

api.onState((nextState) => {
  if (nextState && Array.isArray(nextState.tabs)) {
    state = nextState;
    render();
  }
});
api.onFocusAddress(() => {
  el.addressInput.focus();
  el.addressInput.select();
});
api.getState().then((nextState) => {
  if (nextState && Array.isArray(nextState.tabs)) {
    state = nextState;
    render();
  }
}).catch(() => showToast("Could not read browser state."));
