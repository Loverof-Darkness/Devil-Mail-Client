const DEFAULT_INTERVAL = 60000;

function parseStatus(payload) {
  const unreadCandidates = [
    payload?.unreadCount,
    payload?.unread,
    payload?.data?.unreadCount,
    payload?.data?.unread
  ];

  const rawUnread = unreadCandidates.find((value) => value !== undefined && value !== null);
  const unreadCount = Number.isFinite(Number(rawUnread))
    ? Math.max(0, Math.floor(Number(rawUnread)))
    : null;

  const latest = payload?.latestMessageId ?? payload?.latest?.id ?? payload?.data?.latestMessageId ?? "";
  const subject = payload?.latestSubject ?? payload?.latest?.subject ?? payload?.data?.latestSubject ?? "";
  const from = payload?.latestFrom ?? payload?.latest?.from ?? payload?.data?.latestFrom ?? "";

  return {
    unreadCount,
    latestMessageId: typeof latest === "string" ? latest.slice(0, 200) : "",
    latestSubject: typeof subject === "string" ? subject.slice(0, 200) : "",
    latestFrom: typeof from === "string" ? from.slice(0, 200) : ""
  };
}

export class MailMonitorManager {
  constructor({ onUpdate, onNewMail }) {
    this.onUpdate = onUpdate;
    this.onNewMail = onNewMail;
    this.timers = new Map();
    this.running = new Set();
  }

  stopAll() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.running.clear();
  }

  sync(tabs) {
    const desired = new Map(tabs.filter((tab) => tab.monitorUrl).map((tab) => [tab.id, tab]));

    for (const [tabId, timer] of this.timers) {
      if (!desired.has(tabId)) {
        clearTimeout(timer);
        this.timers.delete(tabId);
        this.running.delete(tabId);
      }
    }

    for (const tab of desired.values()) {
      if (!this.timers.has(tab.id) && !this.running.has(tab.id)) {
        this.#schedule(tab, 0);
      }
    }
  }

  #schedule(tab, delay) {
    const timer = setTimeout(() => {
      this.timers.delete(tab.id);
      this.#check(tab).catch(() => {}).finally(() => {
        if (tab.monitorUrl) this.#schedule(tab, tab.monitorInterval || DEFAULT_INTERVAL);
      });
    }, Math.max(0, delay));
    this.timers.set(tab.id, timer);
  }

  async #check(tab) {
    if (this.running.has(tab.id)) return;
    this.running.add(tab.id);

    try {
      const response = await fetch(tab.monitorUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        credentials: "omit"
      });

      if (!response.ok) throw new Error(`Monitor returned HTTP ${response.status}.`);
      const type = response.headers.get("content-type") || "";
      if (!type.includes("json")) throw new Error("Monitor response is not JSON.");

      const payload = await response.json();
      const status = parseStatus(payload);
      const hadBaseline = Number.isFinite(tab.lastCheckedAt) && tab.lastCheckedAt > 0;
      const unreadIncreased = status.unreadCount !== null && status.unreadCount > (tab.unreadCount ?? 0);
      const newId = Boolean(status.latestMessageId && tab.latestMessageId && status.latestMessageId !== tab.latestMessageId);
      const isNewMail = hadBaseline && (unreadIncreased || newId);

      Object.assign(tab, {
        unreadCount: status.unreadCount ?? tab.unreadCount ?? 0,
        latestMessageId: status.latestMessageId || tab.latestMessageId || "",
        latestSubject: status.latestSubject || tab.latestSubject || "",
        latestFrom: status.latestFrom || tab.latestFrom || "",
        lastCheckedAt: Date.now(),
        monitorError: ""
      });

      this.onUpdate(tab, isNewMail);
      if (isNewMail) this.onNewMail(tab);
    } catch (error) {
      tab.lastCheckedAt = Date.now();
      tab.monitorError = error instanceof Error ? error.message : "Monitor check failed.";
      this.onUpdate(tab, false);
    } finally {
      this.running.delete(tab.id);
    }
  }

  async checkNow(tab) {
    const hadTimer = this.timers.get(tab.id);
    if (hadTimer) clearTimeout(hadTimer);
    this.timers.delete(tab.id);
    await this.#check(tab);
    if (tab.monitorUrl) this.#schedule(tab, tab.monitorInterval || DEFAULT_INTERVAL);
  }
}
