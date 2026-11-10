import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { createStore } from "../src/store.js";
import { fixedSchedule, reconcileTasks } from "../src/task-integration.js";

const today = "2026-11-04";
function fixture() {
  const state = D.createHabit(
    D.emptyState("Europe/Moscow"),
    { name: "Reading", goal: "at-least", limit: 1, initialCount: 0, startDate: "2026-11-01" },
    today,
    "reading"
  );
  state.habits[0].counts = { "2026-11-01": 1, "2026-11-02": 1, "2026-11-03": 1 };
  return state;
}

test("hiding is independent of archiving, preserves every other field and unhides without altering legacy data", () => {
  const original = fixture(),
    raw = JSON.stringify(original);
  const hidden = D.setHabitHidden(original, "reading", true);
  assert.equal(JSON.stringify(original), raw);
  assert.equal(hidden.habits[0].hidden, true);
  assert.equal(hidden.habits[0].endDate, null);
  assert.deepEqual(D.setHabitHidden(hidden, "reading", false), original);
  assert.deepEqual(D.setHabitHidden(hidden, "reading", true), hidden);
});

test("hidden habits keep their history, calendar assessments, streaks and statistics", () => {
  const original = fixture(),
    hidden = D.setHabitHidden(original, "reading", true);
  assert.deepEqual(
    D.habitStreak(hidden.habits[0], today, today),
    D.habitStreak(original.habits[0], today, today)
  );
  assert.deepEqual(
    D.monthCalendar(hidden.habits[0], "2026-11", today),
    D.monthCalendar(original.habits[0], "2026-11", today)
  );
  assert.deepEqual(
    D.statistics(hidden, "2026-11-01", today, today),
    D.statistics(original, "2026-11-01", today, today)
  );
  const changed = D.setCount(hidden, "reading", today, 1, today);
  assert.equal(changed.habits[0].counts[today], 1);
  assert.equal(changed.habits[0].hidden, true);
});

test("active and hidden filters are disjoint, all includes hidden and archive has independent membership", () => {
  const visible = fixture().habits[0],
    hidden = { ...visible, hidden: true },
    archived = { ...hidden, endDate: today };
  for (const [habit, expected] of [
    [visible, [true, false, false, true]],
    [hidden, [false, true, false, true]],
    [archived, [false, false, true, true]]
  ])
    assert.deepEqual(
      ["active", "hidden", "archived", "all"].map((filter) => D.habitMatchesFilter(habit, filter)),
      expected
    );
  assert.equal(D.habitMatchesFilter({ ...visible, hidden: false }, "active"), true);
  const state = D.archiveHabit(D.setHabitHidden(fixture(), "reading", true), "reading", today);
  assert.equal(D.habitMatchesFilter(state.habits[0], "archived"), true);
  assert.equal(D.habitMatchesFilter(state.habits[0], "hidden"), false);
});

test("old backups remain unchanged and hidden visibility survives export/import; malformed flags are rejected", () => {
  const original = fixture(),
    raw = JSON.stringify(original);
  assert.equal(JSON.stringify(D.parseState(raw)), raw);
  const hidden = D.setHabitHidden(original, "reading", true);
  assert.deepEqual(D.parseState(JSON.stringify(hidden)), hidden);
  for (const value of [null, 0, 1, "true", [], {}]) {
    const invalid = fixture();
    invalid.habits[0].hidden = value;
    assert.throws(() => D.validateState(invalid));
    assert.throws(() => D.setHabitHidden(original, "reading", value));
  }
  assert.throws(() => D.setHabitHidden(original, "missing", true));
});

test("visibility mutations use fresh serialized storage and failures do not produce a successful local hide", async () => {
  let raw = JSON.stringify(fixture()),
    fail = false;
  const store = createStore({
    loadSyncedData: async () => raw,
    persistDataSynced: async (value) => {
      if (fail) throw Error("disk full");
      raw = value;
    }
  });
  await store.reload();
  await Promise.all([
    store.mutate((s) => D.setHabitHidden(s, "reading", true)),
    store.mutate((s) => D.setCount(s, "reading", today, 2, today))
  ]);
  assert.equal(store.snapshot().state.habits[0].hidden, true);
  assert.equal(store.snapshot().state.habits[0].counts[today], 2);
  await store.reload();
  assert.equal(store.snapshot().state.habits[0].hidden, true);
  fail = true;
  await assert.rejects(
    store.mutate((s) => D.setHabitHidden(s, "reading", false)),
    /disk full/
  );
  assert.equal(store.snapshot().state.habits[0].hidden, true);
  assert.equal(store.snapshot().blocked, true);
  fail = false;
  await store.reload();
  await store.mutate((s) => D.setHabitHidden(s, "reading", false));
  assert.equal(store.snapshot().state.habits[0].hidden, undefined);
  assert.equal(store.snapshot().state.habits[0].counts[today], 2);
});

test("task completions and undo still update a linked hidden habit without changing its visibility", () => {
  const cfg = {
    id: "series",
    title: "Reading",
    repeatCycle: "DAILY",
    repeatEvery: 1,
    startDate: today,
    startTime: "20:00"
  };
  const linked = D.setTaskSchedule(fixture(), "reading", fixedSchedule(cfg), today);
  const hidden = D.setHabitHidden(linked, "reading", true);
  const task = {
    id: "task",
    repeatCfgId: "series",
    isDone: true,
    doneOn: Date.parse("2026-11-04T12:00:00Z")
  };
  const completed = reconcileTasks(hidden, [task], { series: cfg }, today);
  assert.equal(completed.habits[0].hidden, true);
  assert.equal(D.dayResult(completed.habits[0], today, today).count, 1);
  const undone = reconcileTasks(
    completed,
    [{ ...task, isDone: false, doneOn: null }],
    { series: cfg },
    today
  );
  assert.equal(undone.habits[0].hidden, true);
  assert.equal(D.dayResult(undone.habits[0], today, today).count, 0);
  assert.equal(undone.habits[0].endDate, null);
});

test("deleting a habit removes only that habit and rejects unknown ids", () => {
  const state = D.createHabit(
    fixture(),
    { name: "Walking", goal: "at-least", limit: 1, initialCount: 0, startDate: "2026-11-01" },
    today,
    "walking"
  );
  const raw = JSON.stringify(state);
  const next = D.deleteHabit(state, "reading");
  assert.equal(JSON.stringify(state), raw);
  assert.deepEqual(
    next.habits.map((h) => h.id),
    ["walking"]
  );
  assert.deepEqual(
    D.deleteHabit(D.setHabitHidden(state, "walking", true), "walking").habits.length,
    1
  );
  assert.throws(() => D.deleteHabit(state, "missing"));
});

test("the hidden toggle widens the active filter and statistics can exclude hidden habits", () => {
  const state = D.setHabitHidden(fixture(), "reading", true),
    habit = state.habits[0];
  assert.equal(D.habitMatchesFilter(habit, "active"), false);
  assert.equal(D.habitMatchesFilter(habit, "active", true), true);
  assert.equal(D.habitMatchesFilter(habit, "archived", true), false);
  assert.equal(D.statistics(state, "2026-11-01", today, today, "all").rows.length, 1);
  assert.equal(D.statistics(state, "2026-11-01", today, today, "all", false).rows.length, 0);
});
