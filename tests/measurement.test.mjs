import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { createStore } from "../src/store.js";
const today = "2026-11-03";
function coffee() {
  return D.createHabit(
    D.emptyState("Europe/Moscow"),
    { name: "Coffee", unit: "ml", step: 100, limit: 300, initialCount: 0, startDate: "2026-11-01" },
    today,
    "coffee"
  );
}
test("volume uses configured step and inclusive daily limit", () => {
  let state = coffee();
  for (let i = 0; i < 3; i++) state = D.changeCount(state, "coffee", today, 1, today);
  assert.equal(state.habits[0].counts[today], 300);
  assert.equal(D.dayResult(state.habits[0], today, today).kind, "today-good");
  state = D.changeCount(state, "coffee", today, 1, today);
  assert.equal(state.habits[0].counts[today], 400);
  assert.equal(D.dayResult(state.habits[0], today, today).kind, "today-bad");
  state = D.changeCount(state, "coffee", today, -1, today);
  assert.equal(state.habits[0].counts[today], 300);
});
test("manual volume need not be a multiple of step; decrement clamps and overflow is rejected", () => {
  let state = D.setCount(coffee(), "coffee", today, 50, today);
  state = D.changeCount(state, "coffee", today, -1, today);
  assert.equal(state.habits[0].counts[today], 0);
  state = D.setCount(state, "coffee", today, D.MAX_VALUE - 50, today);
  assert.throws(() => D.changeCount(state, "coffee", today, 1, today));
});
test("old backups remain unchanged and use one event per click", () => {
  const old = {
    schemaVersion: 1,
    timeZone: "UTC",
    habits: [
      {
        id: "old",
        name: "Legacy habit",
        startDate: today,
        endDate: null,
        limits: [{ from: today, value: 3 }],
        counts: { [today]: 2 }
      }
    ]
  };
  const raw = JSON.stringify(old),
    parsed = D.parseState(raw);
  assert.equal(JSON.stringify(parsed), raw);
  assert.equal(D.unitOf(parsed.habits[0]), "times");
  assert.equal(D.stepOf(parsed.habits[0]), 1);
  assert.equal(D.changeCount(parsed, "old", today, 1, today).habits[0].counts[today], 3);
});
test("editing measurement preserves stored values and historical limits without unit conversion", () => {
  const state = D.setCount(coffee(), "coffee", "2026-11-01", 200, today);
  const edited = D.editHabit(
    state,
    "coffee",
    { name: "Coffee", unit: "g", step: 50, limit: 250, from: today },
    today
  );
  assert.equal(edited.habits[0].counts["2026-11-01"], 200);
  assert.equal(D.limitForDate(edited.habits[0], "2026-11-01"), 300);
  assert.equal(edited.habits[0].unit, "g");
  const renamed = D.editHabit(
    edited,
    "coffee",
    { name: "Renamed", limit: 250, from: today },
    today
  );
  assert.equal(renamed.habits[0].unit, "g");
  assert.equal(renamed.habits[0].step, 50);
});
test("invalid measurement metadata is rejected during import and editing", () => {
  for (const patch of [
    { step: 0 },
    { step: -1 },
    { step: 0.5 },
    { step: "100" },
    { unit: "" },
    { unit: null },
    { unit: "a".repeat(17) },
    { unit: "ml\n" }
  ]) {
    const state = coffee();
    Object.assign(state.habits[0], patch);
    assert.throws(() => D.parseState(JSON.stringify(state)));
  }
  assert.throws(() =>
    D.editHabit(coffee(), "coffee", { name: "Coffee", limit: 300, from: today, step: 0 }, today)
  );
});
test("mixed-unit statistics keep quantities separate; success rates remain combinable", () => {
  let state = D.setCount(coffee(), "coffee", "2026-11-02", 200, today);
  state = D.createHabit(
    state,
    {
      name: "Cigarettes",
      unit: "items",
      step: 1,
      limit: 2,
      initialCount: 0,
      startDate: "2026-11-02"
    },
    today,
    "smoke"
  );
  state = D.setCount(state, "smoke", "2026-11-02", 3, today);
  const data = D.statistics(state, "2026-11-02", "2026-11-02", today);
  assert.equal(data.total.events, null);
  assert.deepEqual(data.total.amounts, [
    { unit: "ml", value: 200 },
    { unit: "items", value: 3 }
  ]);
  assert.equal(data.total.successRate, 0.5);
  assert.equal(data.rows[0].unit, "ml");
  assert.equal(data.rows[0].average, 200);
  assert.equal(data.rows[1].unit, "items");
  state = D.createHabit(
    state,
    { name: "Tea", unit: "ml", step: 50, limit: 300, initialCount: 0, startDate: "2026-11-02" },
    today,
    "tea"
  );
  state = D.setCount(state, "tea", "2026-11-02", 100, today);
  assert.deepEqual(D.statistics(state, "2026-11-02", "2026-11-02", today).total.amounts, [
    { unit: "ml", value: 300 },
    { unit: "items", value: 3 }
  ]);
});
test("rapid volume clicks are serialized and measurement metadata survives reopening", async () => {
  let raw = JSON.stringify(coffee());
  const api = {
    loadSyncedData: async () => raw,
    persistDataSynced: async (value) => {
      raw = value;
    }
  };
  const store = createStore(api);
  await store.reload();
  await Promise.all(
    Array.from({ length: 4 }, () =>
      store.mutate((s) => D.changeCount(s, "coffee", today, 1, today))
    )
  );
  const reopened = createStore(api);
  await reopened.reload();
  assert.equal(reopened.snapshot().state.habits[0].counts[today], 400);
  assert.equal(D.unitOf(reopened.snapshot().state.habits[0]), "ml");
  assert.equal(D.stepOf(reopened.snapshot().state.habits[0]), 100);
});

test("manual entry sets or adjusts arbitrary amounts independently of the button step", () => {
  const original = D.setCount(coffee(), "coffee", "2026-11-02", 70, today);
  let state = D.applyCountInput(original, "coffee", today, 250, "set", today);
  state = D.applyCountInput(state, "coffee", today, 75, "add", today);
  assert.equal(state.habits[0].counts[today], 325);
  assert.equal(D.dayResult(state.habits[0], today, today).kind, "today-bad");
  state = D.applyCountInput(state, "coffee", today, 25, "subtract", today);
  assert.equal(D.dayResult(state.habits[0], today, today).kind, "today-good");
  assert.equal(state.habits[0].counts["2026-11-02"], 70);
  assert.equal(state.habits[0].step, 100);
  assert.equal(original.habits[0].counts[today], undefined);
  state = D.applyCountInput(state, "coffee", today, 0, "set", today);
  assert.equal(state.habits[0].counts[today], 0);
});
test("manual entry rejects negative totals, overflow, invalid amounts, operations and dates", () => {
  const state = D.setCount(coffee(), "coffee", today, 100, today);
  for (const [value, mode] of [
    [101, "subtract"],
    [D.MAX_VALUE, "add"],
    [-1, "set"],
    [1.5, "set"],
    [NaN, "set"],
    [Infinity, "add"],
    [1, "unknown"]
  ]) {
    assert.throws(() => D.applyCountInput(state, "coffee", today, value, mode, today));
  }
  for (const date of ["2026-10-31", "2026-11-04"]) {
    assert.throws(() => D.applyCountInput(state, "coffee", date, 25, "add", today));
  }
  assert.equal(state.habits[0].counts[today], 100);
});
test("manual addition uses freshly read storage and survives reopening", async () => {
  let raw = JSON.stringify(D.setCount(coffee(), "coffee", today, 100, today));
  const api = {
    loadSyncedData: async () => raw,
    persistDataSynced: async (value) => {
      raw = value;
    }
  };
  const store = createStore(api);
  await store.reload();
  raw = JSON.stringify(D.setCount(coffee(), "coffee", today, 200, today));
  await store.mutate((state) => D.applyCountInput(state, "coffee", today, 75, "add", today));
  const reopened = createStore(api);
  await reopened.reload();
  assert.equal(reopened.snapshot().state.habits[0].counts[today], 275);
});
