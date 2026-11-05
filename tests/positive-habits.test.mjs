import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { createStore } from "../src/store.js";
import { habitName, resultLabel } from "../src/ui/format.js";

const today = "2026-11-04";
function fixture(overrides = {}) {
  return D.createHabit(
    D.emptyState("Europe/Moscow"),
    {
      name: "Reading",
      emoji: "📚",
      goal: "at-least",
      unit: "min",
      step: 10,
      startDate: "2026-11-01",
      limit: 20,
      initialCount: 0,
      ...overrides
    },
    today,
    "reading"
  );
}

test("positive daily goals require the inclusive minimum; today remains provisional", () => {
  const state = fixture(),
    habit = state.habits[0];
  for (const [count, success] of [
    [0, false],
    [19, false],
    [20, true],
    [30, true]
  ]) {
    habit.counts["2026-11-03"] = count;
    habit.counts[today] = count;
    assert.equal(D.dayResult(habit, "2026-11-03", today).kind, success ? "success" : "failure");
    assert.equal(D.dayResult(habit, today, today).kind, success ? "today-good" : "today-bad");
  }
  assert.equal(D.dayResult(habit, "2026-10-31", today).kind, "inactive");
  assert.equal(D.dayResult(habit, "2026-11-05", today).kind, "future");
});

test("positive rolling targets include earlier events and expire at the exact window boundary", () => {
  const state = fixture({ limit: 3, periodDays: 7 }),
    habit = state.habits[0];
  habit.counts = { "2026-11-01": 2, "2026-11-02": 1 };
  assert.equal(D.dayResult(habit, "2026-11-01", today).kind, "failure");
  assert.equal(D.dayResult(habit, "2026-11-02", today).kind, "success");
  assert.equal(D.dayResult(habit, "2026-11-07", "2026-11-10").kind, "success");
  assert.equal(D.dayResult(habit, "2026-11-08", "2026-11-10").kind, "failure");
  const result = D.statistics(state, "2026-11-03", today, today).rows[0];
  assert.equal(result.events, 0);
  assert.equal(result.successDays, 1);
  assert.equal(result.today.within, true);
  assert.equal(result.today.periodCount, 3);
});

test("changing direction at equal value versions the rule and preserves earlier assessments", () => {
  let state = fixture({ goal: "at-most", limit: 1 });
  state = D.setCount(state, "reading", "2026-11-02", 1, today);
  const old = JSON.stringify(state);
  const changed = D.editHabit(
    state,
    "reading",
    { name: "Reading", from: "2026-11-03", limit: 1, goal: "at-least" },
    today
  );
  const habit = changed.habits[0];
  assert.equal(JSON.stringify(state), old);
  assert.equal(habit.limits.length, 2);
  assert.equal(D.dayResult(habit, "2026-11-01", today).kind, "success");
  assert.equal(D.dayResult(habit, "2026-11-03", today).kind, "failure");
  assert.deepEqual(habit.counts, state.habits[0].counts);
  const renamed = D.editHabit(
    changed,
    "reading",
    { name: "Books", from: today, limit: 1, emoji: "👩🏽‍💻" },
    today
  );
  assert.equal(D.goalForDate(renamed.habits[0], today), "at-least");
  assert.equal(renamed.habits[0].limits.length, 2);
});

test("positive calendar zones separate minimum and ideal without turning overachievement into failure", () => {
  const state = fixture(),
    habit = state.habits[0];
  habit.zones = { enabled: true, idealMax: 30, yellowMax: null, yellowEnabled: true };
  for (const [count, zone] of [
    [0, "red"],
    [19, "red"],
    [20, "warning"],
    [29, "warning"],
    [30, "ideal"],
    [100, "ideal"]
  ]) {
    habit.counts[today] = count;
    assert.equal(D.calendarResult(habit, today, today).zone, zone);
  }
  habit.counts[today] = 20;
  habit.zones.yellowEnabled = false;
  assert.equal(D.calendarResult(habit, today, today).zone, "neutral");
  assert.equal(D.calendarResult(habit, today, today).kind, "today-good");
  habit.zones.enabled = false;
  habit.counts[today] = 0;
  assert.equal(D.calendarResult(habit, today, today).zone, "neutral");
  assert.equal(D.dayResult(habit, today, today).kind, "today-bad");
  habit.zones.enabled = true;
  habit.limits.push({ from: today, value: 40, goal: "at-least" });
  assert.equal(D.calendarResult(habit, today, today).idealMax, 40);
});

test("statistics count missing positive records as failures, while zero minimum succeeds", () => {
  for (const [minimum, successes] of [
    [20, 0],
    [0, 3]
  ]) {
    const state = fixture({ limit: minimum });
    const result = D.statistics(state, "2026-11-01", today, today).rows[0];
    assert.equal(result.successDays, successes);
    assert.equal(result.exceededDays, 3 - successes);
    assert.equal(result.completedDays, 3);
    assert.equal(result.today.within, minimum === 0);
  }
});

test("mixed statistics and archived positive history exclude inactive and provisional days", () => {
  let state = fixture();
  state = D.setCount(state, "reading", "2026-11-02", 20, today);
  state = D.archiveHabit(state, "reading", "2026-11-03");
  state = D.createHabit(
    state,
    { name: "Coffee", startDate: "2026-11-01", limit: 0, initialCount: 0 },
    today,
    "coffee"
  );
  const data = D.statistics(state, "2026-10-30", today, today);
  assert.equal(data.rows[0].completedDays, 3);
  assert.equal(data.rows[0].successDays, 1);
  assert.equal(data.rows[0].today, null);
  assert.equal(data.total.completedDays, 6);
  assert.equal(data.total.successDays, 4);
});

test("sparse statistics match an independent daily oracle across mixed directions and changing periods", () => {
  for (let seed = 0; seed < 16; seed++) {
    const state = fixture(),
      habit = state.habits[0];
    habit.startDate = "2026-01-01";
    habit.limits = [
      { from: "2026-01-01", value: seed % 4, goal: "at-least", periodDays: 7 },
      { from: "2026-01-09", value: 2, periodDays: 2 },
      { from: "2026-01-18", value: 5, goal: "at-least", periodDays: 14 },
      { from: "2026-02-01", value: 1, goal: "at-least" }
    ];
    habit.counts = {};
    for (let index = 0; index < 45; index++)
      if ((index * 7 + seed) % 5 < 2)
        habit.counts[D.addDays(habit.startDate, index)] = (index + seed) % 4;
    D.validateState(state);
    for (const [from, to] of [
      ["2026-01-01", "2026-02-14"],
      ["2026-01-20", "2026-02-12"],
      ["2026-02-05", "2026-02-14"]
    ]) {
      let success = 0,
        failed = 0;
      for (let date = from; date < to; date = D.addDays(date, 1)) {
        const rule = habit.limits.filter((entry) => entry.from <= date).at(-1);
        const begin = D.addDays(date, 1 - (rule.periodDays ?? 1));
        const total = Object.entries(habit.counts).reduce(
          (sum, [day, value]) => sum + (day >= begin && day <= date ? value : 0),
          0
        );
        if (rule.goal === "at-least" ? total >= rule.value : total <= rule.value) success++;
        else failed++;
      }
      const result = D.statistics(state, from, to, to).rows[0];
      assert.equal(result.successDays, success, `seed ${seed}, ${from}–${to}`);
      assert.equal(result.exceededDays, failed);
    }
  }
});

test("long empty positive history counts millions of failures without iterating each day", () => {
  const state = fixture({ startDate: "1900-01-01" });
  const result = D.statistics(state, "1900-01-01", "9999-12-31", "9999-12-31").rows[0];
  assert.ok(result.completedDays > 2900000);
  assert.equal(result.successDays, 0);
  assert.equal(result.exceededDays, result.completedDays);
});

test("old data remains unchanged on read and new metadata survives daily totals and reload", async () => {
  const legacy = fixture({ goal: undefined, emoji: undefined });
  const rawLegacy = JSON.stringify(legacy);
  assert.equal(JSON.stringify(D.parseState(rawLegacy)), rawLegacy);
  assert.equal(D.goalForDate(legacy.habits[0], today), "at-most");
  let raw = JSON.stringify(fixture({ emoji: "🏃🏽‍♂️" }));
  const store = createStore({
    loadSyncedData: async () => raw,
    persistDataSynced: async (value) => {
      raw = value;
    }
  });
  await store.reload();
  await store.mutate((state) => D.changeCount(state, "reading", today, 1, today));
  await store.mutate((state) => D.changeCount(state, "reading", today, 1, today));
  await store.reload();
  const habit = store.snapshot().state.habits[0];
  assert.equal(habit.emoji, "🏃🏽‍♂️");
  assert.equal(habit.counts[today], 20);
  assert.equal(habit.journal, undefined);
  assert.equal(D.dayResult(habit, today, today).kind, "today-good");
});

test("single emoji validation supports composed emoji and rejects text or several symbols", () => {
  for (const emoji of ["", "☕", "👩🏽‍💻", "🏳️‍🌈", "🇷🇺", "1️⃣", "👨‍👩‍👧‍👦", "❤️"])
    assert.equal(D.validEmoji(emoji), true, emoji);
  for (const emoji of ["coffee", "📚💪", " 📚", "📚\n", "x", "1", null, 3, "x".repeat(65)]) {
    assert.equal(D.validEmoji(emoji), false);
    assert.throws(() => fixture({ emoji }));
  }
  const state = fixture();
  state.habits[0].emoji = "☕📚";
  assert.throws(() => D.parseState(JSON.stringify(state)));
  assert.throws(() => fixture({ goal: "invalid" }));
  assert.throws(() =>
    D.editHabit(
      fixture(),
      "reading",
      { name: "Reading", from: today, limit: 20, goal: "invalid" },
      today
    )
  );
});

test("reduction plans cannot silently turn a positive target into a maximum", () => {
  const state = fixture();
  assert.throws(() =>
    D.scheduleReduction(
      state,
      "reading",
      { first: "2026-11-10", everyDays: 7, decrease: 1, target: 0 },
      today
    )
  );
  assert.throws(() =>
    D.scheduleFrequency(state, "reading", [{ from: "2026-11-10", value: 1, periodDays: 7 }], today)
  );
});

test("positive labels distinguish a pending day from failure and format habit emoji", () => {
  const habit = fixture().habits[0];
  assert.equal(habitName(habit), "📚 Reading");
  assert.equal(habitName({ name: "Coffee" }), "Coffee");
  assert.match(resultLabel(D.calendarResult(habit, today, today)), /not met yet.*day in progress/);
  assert.match(resultLabel(D.calendarResult(habit, "2026-11-03", today)), /❌ Goal not met/);
  habit.counts[today] = 20;
  assert.match(resultLabel(D.calendarResult(habit, today, today)), /Goal met.*day in progress/);
});
