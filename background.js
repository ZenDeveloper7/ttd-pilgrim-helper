(() => {
  "use strict";

  if (!globalThis.TTDPlan && typeof importScripts === "function") importScripts("plan.js");
  const api = globalThis.chrome || globalThis.browser;
  const PLAN_KEY = "ttdBookingPlanV1";
  const LISTS_KEY = "ttdPilgrimHelperV1";
  const ALARM_NAME = "ttd-booking-open";
  const MAX_ALARM_LATENESS_MS = 10 * 60_000;
  const activeTabRuns = new Set();

  function getLocal(key) {
    return new Promise((resolve, reject) => api.storage.local.get(key, (value) => {
      const error = api.runtime.lastError;
      error ? reject(new Error(error.message)) : resolve(value[key]);
    }));
  }

  function setLocal(key, value) {
    return new Promise((resolve, reject) => api.storage.local.set({ [key]: value }, () => {
      const error = api.runtime.lastError;
      error ? reject(new Error(error.message)) : resolve();
    }));
  }

  function createTab(url) {
    return new Promise((resolve, reject) => api.tabs.create({ url, active: true }, (tab) => {
      const error = api.runtime.lastError;
      error ? reject(new Error(error.message)) : resolve(tab);
    }));
  }

  function sendToTab(tabId, message) {
    return new Promise((resolve, reject) => api.tabs.sendMessage(tabId, message, (answer) => {
      const error = api.runtime.lastError;
      error ? reject(new Error(error.message)) : resolve(answer);
    }));
  }

  async function updatePlan(patch) {
    const plan = await getLocal(PLAN_KEY);
    if (!plan) return null;
    const updated = { ...plan, ...patch, updatedAt: Date.now() };
    await setLocal(PLAN_KEY, updated);
    return updated;
  }

  function validateList(data, id) {
    const list = data?.lists?.find((item) => item.id === id);
    if (!list?.people?.length || !list.people.every((person) => person.name && person.age && person.gender && person.idNumber)) {
      throw new Error("The selected list needs name, age, gender, and ID number for every pilgrim.");
    }
    return list;
  }

  async function armPlan(input) {
    const plan = globalThis.TTDPlan.preparePlan(input);
    const listData = await getLocal(LISTS_KEY);
    validateList(listData, plan.listId);
    await api.alarms.clear(ALARM_NAME);
    await setLocal(PLAN_KEY, plan);
    await api.alarms.create(ALARM_NAME, { when: plan.openAt });
    return plan;
  }

  async function cancelPlan() {
    await api.alarms.clear(ALARM_NAME);
    activeTabRuns.clear();
    return updatePlan({ status: "cancelled", message: "The scheduled opening was cancelled." });
  }

  async function rearmOnStartup() {
    const plan = await getLocal(PLAN_KEY);
    if (!plan || plan.status !== "armed") return;
    if (plan.openAt <= Date.now()) {
      await updatePlan({ status: "missed", message: "The browser started after the release time. The booking page was not opened." });
      return;
    }
    await api.alarms.create(ALARM_NAME, { when: plan.openAt });
  }

  async function openScheduledPage() {
    const plan = await getLocal(PLAN_KEY);
    if (!plan || plan.status !== "armed") return;
    const lateness = Date.now() - plan.openAt;
    if (lateness < -1000) return;
    if (lateness > MAX_ALARM_LATENESS_MS) {
      await updatePlan({ status: "missed", message: `The browser alarm was ${Math.round(lateness / 1000)} seconds late; no page was opened.` });
      return;
    }
    await updatePlan({ status: "opening", message: "Opening the TTD booking page." });
    const tab = await createTab(plan.bookingUrl);
    await updatePlan({ status: "opening", runningTabId: tab.id, openedAt: Date.now(), message: `Opened TTD ${Math.max(0, Math.round(lateness / 1000))} seconds after the release time.` });
    startInTab(tab.id).catch(() => {});
  }

  async function startInTab(tabId) {
    if (activeTabRuns.has(tabId)) return;
    activeTabRuns.add(tabId);
    try {
    const plan = await getLocal(PLAN_KEY);
    if (!plan || plan.runningTabId !== tabId || !["opening", "running"].includes(plan.status)) return;
    const tab = await new Promise((resolve) => api.tabs.get(tabId, resolve));
    if (!tab?.url || !/^https:\/\/([^.]+\.)*(ttdevasthanams\.ap\.gov\.in|ttdsevaonline\.com)\//.test(tab.url)) {
      await updatePlan({ status: "stopped", message: "TTD opened a page outside its booking domains. Resume manually." });
      return;
    }
    const listData = await getLocal(LISTS_KEY);
    let list;
    try { list = validateList(listData, plan.listId); }
    catch (error) { await updatePlan({ status: "stopped", message: error.message }); return; }
    await updatePlan({ status: "running", message: "TTD page loaded; selecting seva and visit date." });
    try {
      const response = await sendToTab(tabId, { type: "AUTO_BOOK", plan: {
        temple: plan.temple,
        sevaMode: plan.sevaMode,
        seva: plan.seva,
        bookingDate: plan.bookingDate,
        selectedSeva: plan.selectedSeva || "",
        dateConfirmed: Boolean(plan.dateConfirmed)
      }, people: list.people });
      if (["stopped", "payment_page", "payment_requested"].includes(response?.status)) {
        await updatePlan({ status: response.status, message: response.message });
      }
    } catch {
      // Navigation can close the message port. tabs.onUpdated will resume on the next TTD page.
    }
    } finally {
      activeTabRuns.delete(tabId);
    }
  }

  api.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type === "PLAN_SAVE") {
      armPlan(message.plan).then((plan) => respond({ ok: true, plan })).catch((error) => respond({ ok: false, error: error.message }));
      return true;
    }
    if (message?.type === "PLAN_CANCEL") {
      cancelPlan().then((plan) => respond({ ok: true, plan })).catch((error) => respond({ ok: false, error: error.message }));
      return true;
    }
    if (message?.type === "AUTO_PROGRESS" && sender.tab?.id) {
      getLocal(PLAN_KEY).then(async (plan) => {
        if (!plan || plan.runningTabId !== sender.tab.id) return;
        const allowed = ["opening", "running", "payment_requested", "payment_page", "stopped"];
        if (!allowed.includes(message.status)) return;
        const patch = { status: message.status, message: String(message.message || "").slice(0, 250) };
        if (typeof message.selectedSeva === "string") patch.selectedSeva = message.selectedSeva.slice(0, 120);
        if (typeof message.dateConfirmed === "boolean") patch.dateConfirmed = message.dateConfirmed;
        await updatePlan(patch);
      }).catch(() => {});
      return false;
    }
    if (message?.type === "PAGE_READY" && sender.tab?.id) {
      startInTab(sender.tab.id).catch(() => {});
      return false;
    }
    return false;
  });

  api.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) openScheduledPage().catch((error) => updatePlan({ status: "stopped", message: error.message }));
  });

  api.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "complete") startInTab(tabId).catch(() => {});
  });

  api.runtime.onStartup.addListener(() => rearmOnStartup().catch(() => {}));
  api.runtime.onInstalled.addListener(() => rearmOnStartup().catch(() => {}));
})();
