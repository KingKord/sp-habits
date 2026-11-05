import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { createStore } from "../src/store.js";
const today = "2026-11-03";
function fixture(days = 1, value = 1) {
  return D.createHabit(
    D.emptyState("Europe/Moscow"),
    {
      name: "Frequency test",
      unit: "times",
      step: 1,
      limit: value,
      periodDays: days,
      initialCount: 0,
      startDate: "2026-11-01"
    },
    today,
    "test"
  );
}
test("legacy limits remain daily and old JSON is unchanged on read", () => {
  const state = fixture(),
    raw = JSON.stringify(state),
    h = D.parseState(raw).habits[0];
  assert.equal(h.limits[0].periodDays, undefined);
  assert.equal(D.dayResult(h, today, today).periodDays, 1);
  assert.equal(JSON.stringify(D.parseState(raw)), raw);
});
test("one per two calendar days allows equality and rejects consecutive events", () => {
  const h = fixture(2).habits[0];
  h.counts = { "2026-11-01": 1, "2026-11-02": 1 };
  assert.equal(D.dayResult(h, "2026-11-01", today).kind, "success");
  assert.equal(D.dayResult(h, "2026-11-02", today).kind, "failure");
  assert.equal(D.dayResult(h, today, today).kind, "today-good");
  assert.equal(D.dayResult(h, today, today).periodFrom, "2026-11-02");
  assert.equal(D.dayResult(h, today, today).periodCount, 1);
});
test("weekly frequency cannot reset at a week boundary and releases after seven days", () => {
  const h = fixture(7).habits[0];
  h.counts = { "2026-11-01": 1, "2026-11-02": 1 };
  assert.equal(D.dayResult(h, "2026-11-02", "2026-11-10").periodCount, 2);
  assert.equal(D.dayResult(h, "2026-11-07", "2026-11-10").kind, "failure");
  assert.equal(D.dayResult(h, "2026-11-08", "2026-11-10").periodCount, 1);
  assert.equal(D.dayResult(h, "2026-11-08", "2026-11-10").kind, "success");
});
test("changing only the period versions the rule and keeps old assessments and counts", () => {
  const original = fixture();
  original.habits[0].counts = { "2026-11-01": 1, "2026-11-02": 1 };
  const state = D.editHabit(
      original,
      "test",
      { name: "Frequency test", from: today, limit: 1, periodDays: 7 },
      today
    ),
    h = state.habits[0];
  assert.equal(D.dayResult(h, "2026-11-02", today).kind, "success");
  assert.equal(D.dayResult(h, today, today).count, 0);
  assert.equal(D.dayResult(h, today, today).periodCount, 2);
  assert.equal(D.dayResult(h, today, today).kind, "today-bad");
  assert.deepEqual(h.counts, original.habits[0].counts);
  assert.equal(original.habits[0].limits.length, 1);
});
test("stats look back before the selected range without adding those events to its sum", () => {
  const h = fixture(7).habits[0];
  h.counts = { "2026-11-01": 1, "2026-11-02": 1 };
  const state = fixture(7);
  state.habits[0] = h;
  const row = D.statistics(state, today, today, "2026-11-04").rows[0];
  assert.equal(row.events, 0);
  assert.equal(row.completedDays, 1);
  assert.equal(row.exceededDays, 1);
  assert.equal(row.successRate, 0);
  const current = D.statistics(state, today, today, today).rows[0].today;
  assert.deepEqual(current, { count: 0, limit: 1, within: false, periodDays: 7, periodCount: 2 });
});
test("calendar zones compare rolling usage and corrections recalculate subsequent windows", () => {
  let state = fixture(7);
  state.habits[0].counts = { "2026-11-01": 1, "2026-11-02": 1 };
  const h = state.habits[0];
  h.zones = { enabled: true, idealMax: null, yellowMax: 2 };
  assert.equal(D.calendarResult(h, today, today).zone, "red");
  h.zones.yellowMax = null;
  assert.equal(D.calendarResult(h, today, today).zone, "red");
  state = D.setCount(state, "test", "2026-11-01", 0, today);
  assert.equal(D.calendarResult(state.habits[0], today, today).zone, "ideal");
  assert.equal(state.habits[0].counts[today], undefined);
});
const stages = [
  { from: "2026-11-10", value: 1, periodDays: 2 },
  { from: "2026-11-17", value: 1, periodDays: 7 },
  { from: "2026-11-24", value: 1, periodDays: 14 }
];
test("frequency plan supports daily to alternate days to weekly to fortnightly", () => {
  const original = D.applyCountInput(fixture(), "test", today, 1, "add", today);
  const state = D.scheduleFrequency(original, "test", stages, today),
    h = state.habits[0];
  assert.equal(D.periodDaysForDate(h, "2026-11-09"), 1);
  assert.equal(D.periodDaysForDate(h, "2026-11-10"), 2);
  assert.equal(D.periodDaysForDate(h, "2026-11-17"), 7);
  assert.equal(D.periodDaysForDate(h, "2026-11-24"), 14);
  assert.deepEqual(h.counts, original.habits[0].counts);
  assert.deepEqual(h.journal, original.habits[0].journal);
  assert.equal(original.habits[0].limits.length, 1);
});
test("frequency plans reject non-decreasing rate, unordered dates and invalid periods", () => {
  const h = fixture().habits[0];
  for (const plan of [
    [],
    [{ from: today, value: 1, periodDays: 2 }],
    [{ from: "2026-11-10", value: 2, periodDays: 2 }],
    [stages[1], stages[0]],
    [{ ...stages[0], periodDays: 0 }],
    [{ ...stages[0], periodDays: 367 }],
    [{ ...stages[0], value: -1 }]
  ])
    assert.throws(() => D.frequencyPreview(h, plan, today));
  for (const periodDays of [0, 367, 1.5, "7", null]) {
    const state = fixture();
    state.habits[0].limits[0].periodDays = periodDays;
    assert.throws(() => D.validateState(state));
  }
});
test("quantity reduction keeps an existing frequency period; cancel and archive retain passed stages", () => {
  const amountPlan = D.scheduleReduction(
    fixture(7, 3),
    "test",
    { first: "2026-11-10", everyDays: 7, decrease: 1, target: 1 },
    today
  );
  assert.equal(D.periodDaysForDate(amountPlan.habits[0], "2026-11-10"), 7);
  const planned = D.scheduleFrequency(fixture(), "test", stages, today);
  const cancelled = D.cancelReduction(planned, "test", "2026-11-11");
  assert.equal(cancelled.habits[0].limits.length, 2);
  assert.equal(D.periodDaysForDate(cancelled.habits[0], "2026-11-30"), 2);
  const archived = D.archiveHabit(planned, "test", "2026-11-11");
  assert.equal(archived.habits[0].limits.length, 2);
  assert.equal(D.dayResult(archived.habits[0], "2026-11-12", "2026-11-20").editable, false);
});
test("sweep statistics agree with an independent day-by-day oracle across rule changes", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const state = fixture(),
      h = state.habits[0];
    h.startDate = "2026-09-01";
    h.limits = [
      { from: "2026-09-01", value: 2, periodDays: 1 },
      { from: "2026-09-20", value: 2, periodDays: 3 },
      { from: "2026-10-05", value: 1, periodDays: 7 },
      { from: "2026-10-20", value: 1, periodDays: 14 },
      { from: "2026-11-01", value: 0, periodDays: 2 }
    ];
    const dates = Array.from({ length: 64 }, (_, i) => D.addDays(h.startDate, i));
    let random = seed;
    for (const date of dates) {
      random = (random * 1664525 + 1013904223) >>> 0;
      if (random % 5 === 0) h.counts[date] = (random >>> 8) % 3;
    }
    D.validateState(state);
    for (const [from, to] of [
      ["2026-09-01", today],
      ["2026-10-01", "2026-10-25"],
      ["2026-11-01", today]
    ]) {
      let exceeded = 0,
        completed = 0;
      for (let date = from; date <= to; date = D.addDays(date, 1)) {
        if (date === today) continue;
        completed++;
        const rule = h.limits.filter((rule) => rule.from <= date).at(-1),
          days = rule.periodDays ?? 1;
        const first = new Date(date + "T00:00:00Z");
        first.setUTCDate(first.getUTCDate() - days + 1);
        const lower = first.toISOString().slice(0, 10);
        const usage = Object.entries(h.counts)
          .filter(([day]) => day >= lower && day <= date)
          .reduce((sum, [, value]) => sum + value, 0);
        if (usage > rule.value) exceeded++;
      }
      const actual = D.statistics(state, from, to, today).rows[0];
      assert.equal(actual.exceededDays, exceeded, `seed ${seed} ${from}..${to}`);
      assert.equal(actual.completedDays, completed);
    }
  }
});
test("long frequency history uses sparse intervals instead of iterating millions of days", () => {
  const state = fixture(7),
    h = state.habits[0];
  h.startDate = "1900-01-01";
  h.limits[0].from = h.startDate;
  h.counts = { "2026-11-01": 1, "2026-11-02": 1 };
  const row = D.statistics(state, "1900-01-01", "9999-12-31", "9999-12-31").rows[0];
  assert.equal(row.exceededDays, 6);
  assert.ok(row.completedDays > 2900000);
});
test("frequency and daily totals survive a persistent reload without creating journals", async () => {
  let raw = JSON.stringify(fixture());
  const store = createStore({
    loadSyncedData: async () => raw,
    persistDataSynced: async (value) => {
      raw = value;
    }
  });
  await store.reload();
  await store.mutate((s) => D.scheduleFrequency(s, "test", stages, today));
  await store.mutate((s) => D.applyCountInput(s, "test", today, 1, "add", today));
  const reopened = createStore({
    loadSyncedData: async () => raw,
    persistDataSynced: async () => {
      throw Error("read only");
    }
  });
  await reopened.reload();
  const h = reopened.snapshot().state.habits[0];
  assert.equal(D.periodDaysForDate(h, "2026-11-24"), 14);
  assert.equal(h.counts[today], 1);
  assert.equal(h.journal, undefined);
});
