import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { fixedSchedule, reconcileTasks, createTaskIntegration } from "../src/task-integration.js";
import { createStore } from "../src/store.js";

const today = "2026-11-04";
const instant = () => new Date("2026-11-04T12:00:00Z");
const config = (overrides = {}) => ({
  id: "series",
  title: "Reading",
  repeatCycle: "DAILY",
  repeatEvery: 2,
  startDate: today,
  startTime: "20:00",
  isPaused: false,
  ...overrides
});
const task = (overrides = {}) => ({
  id: "task1",
  repeatCfgId: "series",
  isDone: true,
  doneOn: Date.parse("2026-11-04T17:15:00Z"),
  ...overrides
});
function habitState(start = today) {
  return D.createHabit(
    D.emptyState("Europe/Moscow"),
    { name: "Reading", goal: "at-least", limit: 1, initialCount: 0, startDate: start },
    today,
    "reading"
  );
}
function linked(start = today) {
  return D.setTaskSchedule(habitState(start), "reading", fixedSchedule(config()), today);
}
const cfgs = { series: config() };

test("only supported fixed DAILY configurations are linkable; weekdays do not affect DAILY", () => {
  assert.equal(fixedSchedule(config({ startTime: "8:00" })).time, "08:00");
  assert.equal(fixedSchedule(config({ monday: false })).every, 2);
  for (const override of [
    { repeatCycle: "WEEKLY" },
    { repeatFromCompletionDate: true },
    { waitForCompletion: true },
    { repeatEvery: 0 },
    { repeatEvery: 1.5 },
    { startDate: "invalid" },
    { startTime: "25:00" }
  ])
    assert.equal(fixedSchedule(config(override)), null);
});

test("a completion is idempotent across fresh task IDs, reloads and repeated events; undo preserves manual totals", () => {
  let state = habitState();
  state.habits[0].counts[today] = 2;
  state = D.setTaskSchedule(state, "reading", fixedSchedule(config()), today);
  const before = JSON.stringify(state);
  state = reconcileTasks(state, [task()], cfgs, today);
  assert.equal(D.dayResult(state.habits[0], today, today).count, 3);
  assert.equal(state.habits[0].counts[today], 2);
  assert.equal(
    JSON.stringify(
      reconcileTasks(D.parseState(JSON.stringify(state)), [task(), task()], cfgs, today)
    ),
    JSON.stringify(state)
  );
  const undo = reconcileTasks(state, [task({ isDone: false, doneOn: null })], cfgs, today);
  assert.equal(D.dayResult(undo.habits[0], today, today).count, 2);
  assert.equal(JSON.stringify(habitState()).includes("taskCompletions"), false);
  assert.notEqual(before, JSON.stringify(state));
  assert.throws(() => D.setCount(state, "reading", today, 0, today), /task/);
});

test("fixed dates have neutral rest days and a denominator of scheduled days, including missed occurrences", () => {
  let state = linked();
  state = reconcileTasks(
    state,
    [task(), task({ id: "task2", doneOn: Date.parse("2026-11-08T17:00:00Z") })],
    cfgs,
    "2026-11-09"
  );
  const habit = state.habits[0];
  assert.equal(D.calendarResult(habit, "2026-11-05", "2026-11-09").zone, "rest");
  assert.equal(D.calendarResult(habit, "2026-11-05", today).zone, "rest");
  assert.equal(D.dayResult(habit, "2026-11-06", "2026-11-09").kind, "failure");
  const row = D.statistics(state, today, "2026-11-09", "2026-11-09").rows[0];
  assert.equal(row.trackedDays, 3);
  assert.equal(row.completedDays, 3);
  assert.equal(row.successDays, 2);
  assert.equal(row.successRate, 2 / 3);
  assert.equal(row.events, 2);
});

test("late completions land on the actual local day, without repairing the missed scheduled day", () => {
  const state = reconcileTasks(
    linked(),
    [task({ doneOn: Date.parse("2026-11-04T22:30:00Z") })],
    cfgs,
    "2026-11-06"
  );
  const habit = state.habits[0];
  assert.equal(D.countsOf(habit)["2026-11-05"], 1);
  assert.equal(D.dayResult(habit, today, "2026-11-06").kind, "failure");
  assert.equal(D.dayResult(habit, "2026-11-05", "2026-11-06").kind, "rest");
  assert.equal(D.statistics(state, "2026-11-05", "2026-11-05", "2026-11-06").rows[0].events, 1);
});

test("schedule changes and pauses are versioned from today; prior assessments survive", () => {
  let state = reconcileTasks(linked(), [task()], cfgs, "2026-11-06");
  state = reconcileTasks(
    state,
    [],
    { series: config({ repeatEvery: 3, startDate: "2026-11-06", isPaused: true }) },
    "2026-11-06"
  );
  assert.equal(state.habits[0].taskSchedules.length, 2);
  assert.equal(D.dayResult(state.habits[0], today, "2026-11-07").kind, "success");
  assert.equal(D.dayResult(state.habits[0], "2026-11-06", "2026-11-07").kind, "rest");
  const detached = D.setTaskSchedule(state, "reading", null, "2026-11-07");
  assert.equal(D.dayResult(detached.habits[0], "2026-11-07", "2026-11-07").readOnly, false);
  assert.deepEqual(detached.habits[0].taskCompletions, state.habits[0].taskCompletions);
});

test("missing tasks preserve recorded history; observed undo and skipped tasks remove only their own contribution", () => {
  const state = reconcileTasks(linked(), [task()], cfgs, today);
  assert.equal(
    D.dayResult(reconcileTasks(state, [], cfgs, today).habits[0], today, today).count,
    1
  );
  assert.equal(
    D.dayResult(reconcileTasks(state, [task({ wontDoOn: 1 })], cfgs, today).habits[0], today, today)
      .count,
    0
  );
  assert.equal(
    D.dayResult(
      reconcileTasks(linked(), [task({ doneOn: null })], cfgs, today).habits[0],
      today,
      today
    ).count,
    0
  );
  assert.equal(
    D.dayResult(
      reconcileTasks(linked(), [task({ repeatCfgId: "other" })], cfgs, today).habits[0],
      today,
      today
    ).count,
    0
  );
});

test("linking never backfills prior days; until, archives and malformed backups are respected", () => {
  let state = linked("2026-11-01");
  state = reconcileTasks(
    state,
    [task({ doneOn: Date.parse("2026-11-03T12:00:00Z") })],
    cfgs,
    today
  );
  assert.equal(D.dayResult(state.habits[0], "2026-11-03", today).kind, "failure");
  assert.equal(D.dayResult(state.habits[0], today, today).count, 0);
  state = D.setTaskSchedule(
    state,
    "reading",
    fixedSchedule(config({ repeatUntilDay: "2026-11-06" })),
    today
  );
  assert.equal(D.assessedDays(state.habits[0], today, "9999-12-31"), 2);
  const archived = D.archiveHabit(state, "reading", today);
  assert.equal(
    JSON.stringify(reconcileTasks(archived, [task()], cfgs, today)),
    JSON.stringify(archived)
  );
  const invalid = structuredClone(state);
  invalid.habits[0].taskSchedules[0].every = 0;
  assert.throws(() => D.parseState(JSON.stringify(invalid)), /link/);
});

function serviceHarness(initial = linked()) {
  let raw = JSON.stringify(initial),
    app = { tasks: {}, taskRepeatCfgs: cfgs },
    archived = [],
    fail = false,
    writes = 0,
    notices = 0;
  const api = {
    loadSyncedData: async () => raw,
    persistDataSynced: async (value) => {
      if (fail) throw Error("disk");
      raw = value;
      writes++;
    },
    getAppState: async () => app,
    getArchivedTasks: async () => archived,
    showSnack: () => {}
  };
  const service = createTaskIntegration(
    api,
    () => {
      notices++;
    },
    instant
  );
  return {
    service,
    api,
    read: () => raw,
    writes: () => writes,
    notices: () => notices,
    tasks: (tasks) => {
      app = { ...app, tasks: Object.fromEntries(tasks.map((t) => [t.id, t])) };
    },
    archived: (tasks) => {
      archived = tasks;
    },
    fail: () => {
      fail = true;
    }
  };
}

test("background service catches archived completions, prefers live undo, and rejects stale UI saves", async () => {
  const h = serviceHarness();
  const read = await h.service.request({ action: "read" });
  h.archived([task()]);
  await h.service.refresh();
  assert.equal(D.countsOf(JSON.parse(h.read()).habits[0])[today], 1);
  await assert.rejects(
    h.service.request({ action: "write", expected: read.raw, raw: read.raw }),
    /Reload/
  );
  h.tasks([task({ isDone: false, doneOn: null })]);
  await h.service.refresh();
  assert.equal(D.countsOf(JSON.parse(h.read()).habits[0])[today] ?? 0, 0);
  const writes = h.writes();
  await h.service.refresh();
  assert.equal(h.writes(), writes);
});

test("failed task reads and writes never turn into empty history; errors are visible and disposal stops work", async () => {
  const h = serviceHarness();
  const original = h.read();
  h.api.getArchivedTasks = async () => {
    throw Error("archive unavailable");
  };
  await h.service.refresh();
  assert.equal(h.read(), original);
  assert.match((await h.service.request({ action: "read" })).syncError, /archive unavailable/);
  h.service.dispose();
  await assert.rejects(h.service.request({ action: "read" }), /closed/);
  const writeFailure = serviceHarness();
  writeFailure.tasks([task()]);
  writeFailure.fail();
  const before = writeFailure.read();
  await writeFailure.service.refresh();
  assert.equal(writeFailure.read(), before);
});

test("host transaction applies a fresh series link, returns reconciled storage to the UI store, and validates duplicates", async () => {
  const h = serviceHarness(habitState());
  h.archived([task()]);
  let expected;
  const store = createStore({
    loadSyncedData: async () => {
      expected = (await h.service.request({ action: "read" })).raw;
      return expected;
    },
    persistDataSynced: async (raw, linkChange) =>
      (await h.service.request({ action: "write", raw, expected, linkChange })).raw
  });
  await store.reload();
  await store.mutate(
    (s) => D.editHabit(s, "reading", { name: "A book", limit: 1, from: today }, today),
    { id: "reading", repeatId: "series" }
  );
  assert.equal(store.snapshot().state.habits[0].name, "A book");
  assert.equal(D.dayResult(store.snapshot().state.habits[0], today, today).count, 1);
  const state = D.createHabit(
    store.snapshot().state,
    { name: "Other", goal: "at-least", limit: 1, startDate: today, initialCount: 0 },
    today,
    "other"
  );
  assert.throws(
    () => D.setTaskSchedule(state, "other", fixedSchedule(config()), today),
    /another habit/
  );
});

test("scheduled statistics match an independent per-day oracle across rule and schedule changes", () => {
  let state = linked("2026-11-01");
  state = reconcileTasks(
    state,
    [task(), task({ id: "second", doneOn: Date.parse("2026-11-08T12:00:00Z") })],
    cfgs,
    "2026-11-09"
  );
  state = D.setTaskSchedule(
    state,
    "reading",
    fixedSchedule(config({ repeatEvery: 3, startDate: "2026-11-10" })),
    "2026-11-10"
  );
  const end = "2026-12-01",
    habit = state.habits[0];
  let expected = 0,
    successes = 0;
  for (let date = "2026-11-01"; date < end; date = D.addDays(date, 1)) {
    const scheduled =
      date < today ||
      (date < "2026-11-10"
        ? ((Date.parse(date) - Date.parse(today)) / 86400000) % 2 === 0
        : ((Date.parse(date) - Date.parse("2026-11-10")) / 86400000) % 3 === 0);
    if (scheduled) {
      expected++;
      if ((D.countsOf(habit)[date] ?? 0) >= 1) successes++;
    }
  }
  const row = D.statistics(state, "2026-11-01", "2026-11-30", end).rows[0];
  assert.equal(row.completedDays, expected);
  assert.equal(row.successDays, successes);
});

test("broken storage remains available for recovery and background refresh never overwrites it", async () => {
  let writes = 0;
  const service = createTaskIntegration({
    loadSyncedData: async () => "{broken",
    persistDataSynced: async () => {
      writes++;
    },
    showSnack: () => {}
  });
  assert.equal((await service.request({ action: "read" })).raw, "{broken");
  await service.refresh();
  assert.equal(writes, 0);
  assert.ok((await service.request({ action: "read" })).syncError);
});

test("a habit without a link does not read tasks or write storage during background refresh", async () => {
  const h = serviceHarness(habitState());
  h.api.getAppState = async () => {
    throw Error("Tasks should not be read");
  };
  const before = h.read();
  await h.service.refresh();
  assert.equal(h.read(), before);
  assert.equal(h.writes(), 0);
  assert.equal((await h.service.request({ action: "read" })).syncError, "");
});

test("the last supported calendar day remains finite when a completion interval ends past it", () => {
  const day = "9999-12-30";
  let state = D.createHabit(
    D.emptyState("UTC"),
    { name: "Last", goal: "at-least", limit: 1, initialCount: 0, startDate: day },
    "9999-12-31",
    "last"
  );
  state = D.setCount(state, "last", day, 1, "9999-12-31");
  const row = D.statistics(state, day, day, "9999-12-31").rows[0];
  assert.equal(row.successDays, 1);
  assert.equal(row.successRate, 1);
});
