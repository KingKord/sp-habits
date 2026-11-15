import russian from "../src/i18n/ru.json" with { type: "json" };
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { bundle } from "../scripts/bundle.mjs";
import * as D from "../src/domain.js";
import { fixedSchedule } from "../src/task-integration.js";

const script = await bundle("src/plugin.js");
function harness() {
  const day = D.todayInZone("Europe/Moscow");
  const cfg = {
    id: "series",
    title: "Reading",
    repeatCycle: "DAILY",
    repeatEvery: 1,
    startDate: day,
    startTime: "20:00"
  };
  const state = D.setTaskSchedule(
    D.createHabit(
      D.emptyState("Europe/Moscow"),
      { name: "Reading", goal: "at-least", limit: 1, initialCount: 0, startDate: day },
      day,
      "habit"
    ),
    "habit",
    fixedSchedule(cfg),
    day
  );
  let raw = JSON.stringify(state),
    ready,
    unload,
    handler,
    timerCount = 0,
    stopped = false,
    appTasks = {};
  let writes = 0;
  const hooks = new Map(),
    messages = [];
  const source = { postMessage: (m) => messages.push(m) };
  const window = {
    location: { origin: "https://app.test" },
    addEventListener: (_name, fn) => {
      handler = fn;
    },
    removeEventListener: () => {},
    setInterval: () => ++timerCount,
    clearInterval: () => {
      stopped = true;
    }
  };
  const api = {
    loadSyncedData: async () => raw,
    persistDataSynced: async (value) => {
      writes++;
      raw = value;
    },
    getAppState: async () => ({ tasks: appTasks, taskRepeatCfgs: { series: cfg } }),
    getArchivedTasks: async () => [],
    registerHook: (name, fn) => hooks.set(name, fn),
    onReady: (fn) => {
      ready = fn;
    },
    onMessage: (fn) => {
      handler = fn;
    },
    onUnload: (fn) => {
      unload = fn;
    }
  };
  vm.runInNewContext(script, { window, PluginAPI: api, Intl, JSON, structuredClone });
  return {
    day,
    hooks,
    messages,
    source,
    ready: () => ready(),
    unload: () => unload(),
    raw: () => raw,
    replace: (state) => {
      raw = JSON.stringify(state);
    },
    writes: () => writes,
    timers: () => timerCount,
    stopped: () => stopped,
    mount: () => {},
    task: (isDone) => {
      appTasks = {
        task: { id: "task", repeatCfgId: "series", isDone, doneOn: isDone ? Date.now() : null }
      };
    },
    request: async (data) => {
      const result = await handler({ type: "HABITS_EXPORT_REQUEST", asset: "tasks", ...data });
      messages.push(result);
      return result;
    }
  };
}

test("shipped host records and undoes task completions while the view is closed without host DOM access", async () => {
  const h = harness();
  assert.equal(h.hooks.has("taskComplete"), true);
  h.ready();
  h.ready();
  assert.equal(h.timers(), 1);
  h.task(true);
  await h.hooks.get("taskComplete")();
  assert.equal(D.dayResult(JSON.parse(h.raw()).habits[0], h.day, h.day).count, 1);
  const before = await h.request({ asset: "status" });
  h.task(false);
  await h.hooks.get("taskUpdate")();
  assert.equal(D.dayResult(JSON.parse(h.raw()).habits[0], h.day, h.day).count, 0);
  const after = await h.request({ asset: "status" });
  assert.ok(after.revision > before.revision);
  h.unload();
  assert.equal(h.stopped(), true);
  h.ready();
  assert.equal(h.timers(), 1);
  assert.equal((await h.request({ action: "read" })).ok, false);
});

test("persistence deliveries advance public revision without a reconciliation write", async () => {
  for (const linked of [false, true]) {
    const h = harness(),
      state = JSON.parse(h.raw());
    state.habits[0].taskCompletions = {};
    if (!linked) {
      delete state.habits[0].taskSchedules;
      delete state.habits[0].taskCompletions;
    }
    state.habits[0].name = "Delivered name";
    h.replace(state);
    const before = (await h.request({ asset: "status" })).revision;
    await Promise.all(Array.from({ length: 6 }, () => h.hooks.get("persistedDataChanged")()));
    assert.equal(h.writes(), 0);
    assert.ok((await h.request({ asset: "status" })).revision > before);
    assert.equal((await h.request({ action: "read" })).raw, h.raw());
    h.unload();
    await h.hooks.get("persistedDataChanged")();
    assert.equal(h.writes(), 0);
  }
});

test("public task handler reports stale writes without overwriting", async () => {
  const h = harness(),
    original = h.raw();
  assert.equal((await h.request({ action: "read" })).raw, original);
  assert.equal((await h.request({ action: "write", expected: "stale", raw: original })).ok, false);
  assert.equal(h.raw(), original);
  h.unload();
});

test("shipped public handler supplies offline translations and styles", async () => {
  const h = harness(),
    result = await h.request({ asset: "translations" });
  assert.equal(result.ok, true);
  assert.equal(result.messages.Habits, russian.Habits);
  assert.match(result.styles, /\.habit-goal-track/);
  assert.match(result.styles, /\.calendar-grid/);
  assert.equal(h.timers(), 0);
  h.unload();
});
