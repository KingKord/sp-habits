import { t } from "./i18n/index.js";
import { todayInZone } from "./domain.js";
import { createStore } from "./store.js";
import { createExportClient } from "./host/export-client.js";
import { createScope } from "./ui/scope.js";
import { createDOM } from "./ui/dom.js";
import { createHabitEditor } from "./ui/habit-editor.js";
import { createCountEditor } from "./ui/count-editor.js";
import { createPlanEditor } from "./ui/plan-editor.js";
import { createDayView } from "./ui/day-view.js";
import { createCalendarView } from "./ui/calendar-view.js";
import { createStatisticsView } from "./ui/statistics-view.js";
import { mountBackupControls } from "./ui/backup-controls.js";
import { closeOnBackdrop } from "./ui/dialog.js";

// Composition root: features receive only their dependencies and own their UI state.
export function createApplication({ window, api = window.PluginAPI, instant = () => new Date() }) {
  const document = window.document;
  const scope = createScope();
  const dom = createDOM(document, scope);
  const { byId, on } = dom;
  const exportClient = createExportClient(window);
  let expectedRaw = null;
  const taskRequest = (payload) => exportClient.request(false, "tasks", payload);
  const storageAPI = {
    loadSyncedData: async () => {
      const result = await taskRequest({ action: "read" });
      expectedRaw = result.raw;
      byId("task-sync-error").textContent = result.syncError || "";
      return expectedRaw;
    },
    persistDataSynced: async (raw, metadata) => {
      const result = await taskRequest({
        action: "write",
        raw,
        expected: expectedRaw,
        ...(metadata?.increment ? { increment: metadata.increment } : { linkChange: metadata })
      });
      expectedRaw = result.raw;
      return { ...result, effectMessage: result.effectMessage ? t(result.effectMessage) : "" };
    }
  };
  const store = createStore(api ? storageAPI : api, render);
  scope.add(exportClient.dispose);
  scope.add(store.dispose);
  let currentView = "day";

  const now = (state = store.snapshot().state) => todayInZone(state.timeZone, instant());
  const flash = (text) => {
    if (!scope.disposed) byId("message").textContent = text;
  };
  const confirm = (message) => window.confirm(message);

  async function commit(transform, metadata) {
    if (scope.disposed) return false;
    flash("");
    try {
      await store.mutate(transform, metadata);
      flash(store.snapshot().effectMessage);
      refresh();
      return true;
    } catch {
      flash(t("Change not confirmed. Check the error message."));
      return false;
    }
  }

  const editor = createHabitEditor({
    dom,
    store,
    now,
    commit,
    confirm,
    newId: () => window.crypto.randomUUID(),
    loadEmojis: async () => (await exportClient.request(false, "emojis")).catalog,
    systemEmoji: exportClient.systemEmoji,
    loadSchedules: async () => (await taskRequest({ action: "list" })).schedules
  });
  const count = createCountEditor({ dom, store, now, commit });
  const plan = createPlanEditor({ dom, store, now, commit });
  const day = createDayView({
    dom,
    store,
    now,
    commit,
    render,
    flash,
    openEditor: editor.open,
    openCountEditor: count.open,
    confirm,
    newId: () => window.crypto.randomUUID()
  });
  const calendar = createCalendarView({
    dom,
    store,
    now,
    render,
    selectedDate: day.selectedDate,
    selectDate: day.select,
    openEditor: editor.open,
    openCountEditor: count.open,
    openPlan: plan.open
  });
  const statistics = createStatisticsView({ dom, store, now, render });
  mountBackupControls({
    dom,
    store,
    commit,
    render,
    flash,
    resetDay: day.reset,
    exportClient,
    confirm
  });

  // New screens register here; each renderer and its state remain feature-local.
  const views = {
    day: {
      element: "day-view",
      button: "view-day",
      render: (state, today) => day.render(store.snapshot(), today)
    },
    calendar: { element: "calendar-view", button: "view-calendar", render: calendar.render },
    stats: { element: "statistics", button: "view-stats", render: statistics.render }
  };
  for (const [name, view] of Object.entries(views)) {
    on(view.button, "click", () => {
      currentView = name;
      render();
    });
  }

  function render() {
    if (scope.disposed) return;
    const snapshot = store.snapshot();
    byId("error").hidden = !snapshot.error;
    byId("error-text").textContent = snapshot.error;
    byId("raw").hidden = typeof snapshot.raw !== "string";
    byId("reload").disabled = snapshot.pending > 0 || snapshot.busyRead;
    byId("save-status").textContent = snapshot.busyRead
      ? t("Loading…")
      : snapshot.pending
        ? t("Saving… (") + snapshot.pending + ")"
        : snapshot.blocked
          ? t("Saving paused")
          : t("Ready");
    const locked = snapshot.blocked || snapshot.busyRead || !snapshot.state;
    byId("add").disabled = locked || snapshot.pending > 0;
    byId("export").disabled = !snapshot.state || snapshot.pending > 0 || snapshot.busyRead;
    byId("import").disabled = locked || snapshot.pending > 0;
    const today = snapshot.state ? now(snapshot.state) : null;
    if (today) day.prepare(today);
    for (const [name, view] of Object.entries(views)) {
      const active = currentView === name;
      byId(view.element).hidden = !active;
      byId(view.button).setAttribute("aria-pressed", String(active));
      if (active) view.render(snapshot.state, today);
    }
  }

  on("settings", "click", () => byId("info").showModal());
  on("close-info", "click", () => byId("info").close());
  closeOnBackdrop(dom, "info", () => byId("info").close());
  on("theme", "change", (event) => {
    const value = event.target.value;
    if (value === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = value;
  });
  const refresh = () => {
    if (store.snapshot().state && now() !== day.lastToday()) render();
  };
  scope.add(exportClient.subscribe(store.invalidate));
  scope.on(window, "focus", refresh);
  scope.on(document, "visibilitychange", () => {
    if (!document.hidden) refresh();
  });
  const timer = window.setInterval(() => {
    if (!document.hidden) refresh();
  }, 15000);
  scope.add(() => window.clearInterval(timer));
  scope.on(window, "beforeunload", (event) => {
    if (store.snapshot().pending) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  scope.on(window, "pagehide", scope.dispose);
  scope.add(() => {
    for (const dialog of document.querySelectorAll("dialog[open]")) dialog.close();
  });

  return {
    store,
    start: () => (scope.disposed ? Promise.resolve(false) : store.reload()),
    dispose: scope.dispose
  };
}
