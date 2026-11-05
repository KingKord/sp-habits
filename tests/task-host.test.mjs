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
    frames = [],
    appTasks = {};
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
      raw = value;
    },
    getAppState: async () => ({ tasks: appTasks, taskRepeatCfgs: { series: cfg } }),
    getArchivedTasks: async () => [],
    registerHook: (name, fn) => hooks.set(name, fn),
    onReady: (fn) => {
      ready = fn;
    },
    onUnload: (fn) => {
      unload = fn;
    }
  };
  const document = { querySelectorAll: () => frames };
  vm.runInNewContext(script, { window, document, PluginAPI: api, Intl, JSON, structuredClone });
  return {
    day,
    hooks,
    messages,
    source,
    ready: () => ready(),
    unload: () => unload(),
    raw: () => raw,
    timers: () => timerCount,
    stopped: () => stopped,
    mount: () => {
      frames = [{ contentWindow: source, contentDocument: { title: "Habits" } }];
    },
    task: (isDone) => {
      appTasks = {
        task: { id: "task", repeatCfgId: "series", isDone, doneOn: isDone ? Date.now() : null }
      };
    },
    request: async (data, origin = "https://app.test", sender = source) =>
      handler({
        data: {
          type: "HABITS_EXPORT_REQUEST",
          asset: "tasks",
          requestId: "request",
          ...data
        },
        source: sender,
        origin
      })
  };
}

test("shipped host registers hooks, records a completion with the tracker closed, notifies only its frame and undoes", async () => {
  const h = harness();
  assert.equal(h.hooks.has("taskComplete"), true);
  h.ready();
  h.ready();
  assert.equal(h.timers(), 1);
  h.task(true);
  await h.hooks.get("taskComplete")();
  assert.equal(D.dayResult(JSON.parse(h.raw()).habits[0], h.day, h.day).count, 1);
  assert.equal(h.messages.length, 0);
  h.mount();
  h.task(false);
  await h.hooks.get("taskUpdate")();
  assert.equal(D.dayResult(JSON.parse(h.raw()).habits[0], h.day, h.day).count, 0);
  assert.equal(
    h.messages.some((m) => m.type === "HABITS_DATA_CHANGED"),
    true
  );
  h.unload();
  assert.equal(h.stopped(), true);
  h.ready();
  assert.equal(h.timers(), 1);
});

test("shipped bridge accepts task reads only from its iframe and reports stale writes without overwriting", async () => {
  const h = harness();
  h.mount();
  await h.request({ action: "read" }, "https://other.test");
  await h.request({ action: "read" }, undefined, {});
  assert.equal(h.messages.length, 0);
  await h.request({ action: "read" });
  assert.equal(h.messages.at(-1).raw, h.raw());
  const original = h.raw();
  await h.request({ action: "write", expected: "stale", raw: original });
  assert.equal(h.messages.at(-1).ok, false);
  assert.equal(h.raw(), original);
  h.unload();
});

test("the shipped host supplies offline styles with translations to its own iframe", async () => {
  const h = harness();
  h.mount();
  await h.request({ asset: "translations" });
  const response = h.messages.at(-1);
  assert.equal(response.ok, true);
  assert.equal(response.messages["Habits"], russian.Habits);
  assert.match(response.styles, /\.habit-goal-track/);
  assert.match(response.styles, /\.habit-visibility/);
  assert.match(response.styles, /\.calendar-grid/);
  assert.equal(h.timers(), 0);
});
