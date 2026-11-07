import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { createStore } from "../src/store.js";
import { countText, resultLabel, ruleText, usageText } from "../src/ui/format.js";

const today = "2026-11-07";
function fixture(overrides = {}) {
  return D.createHabit(
    D.emptyState("Europe/Moscow"),
    {
      name: "Get up",
      goal: "by-time",
      limit: 480,
      unit: "min",
      step: 1,
      startDate: "2026-11-01",
      initialCount: 0,
      ...overrides
    },
    today,
    "wake"
  );
}

test("time goals need an explicit record, including at midnight and at the exact deadline", () => {
  const state = fixture(),
    habit = state.habits[0];
  assert.equal(D.dayResult(habit, today, today).kind, "today-bad");
  assert.equal(D.calendarResult(habit, "2026-11-06", today).zone, "red");
  for (const [time, good] of [
    [0, true],
    [479, true],
    [480, true],
    [481, false],
    [1439, false]
  ]) {
    const changed = D.setCount(state, "wake", "2026-11-06", time, today);
    const result = D.calendarResult(changed.habits[0], "2026-11-06", today);
    assert.equal(result.recorded, true);
    assert.equal(result.kind, good ? "success" : "failure");
    assert.equal(result.zone, good ? "ideal" : "red");
    assert.deepEqual(habit.counts, {});
  }
  assert.equal(D.dayResult(habit, "2026-10-31", today).kind, "inactive");
  assert.equal(D.dayResult(habit, "2026-11-08", today).kind, "future");
});

test("a midnight target requires a midnight record and clearing it restores not done", () => {
  let state = fixture({ limit: 0, recorded: true });
  assert.equal(D.dayResult(state.habits[0], today, today).kind, "today-good");
  state = D.clearTimeRecord(state, "wake", today, today);
  assert.equal(D.dayResult(state.habits[0], today, today).recorded, false);
  assert.equal(D.dayResult(state.habits[0], today, today).kind, "today-bad");
  assert.throws(() => D.clearTimeRecord(state, "wake", "2026-11-08", today));
});

test("dated deadline changes and earlier tracking preserve recorded times and old assessments", () => {
  let state = fixture();
  state = D.setCount(state, "wake", "2026-11-03", 475, today);
  state = D.setCount(state, "wake", "2026-11-06", 475, today);
  const changed = D.editHabit(
    state,
    "wake",
    {
      name: "Get up",
      from: "2026-11-05",
      limit: 465,
      zones: { enabled: true, idealMax: 465, yellowMax: null, yellowEnabled: false }
    },
    today
  );
  assert.deepEqual(changed.habits[0].counts, state.habits[0].counts);
  assert.equal(D.dayResult(changed.habits[0], "2026-11-03", today).kind, "success");
  assert.equal(D.dayResult(changed.habits[0], "2026-11-06", today).kind, "failure");
  assert.equal(D.calendarResult(changed.habits[0], "2026-11-03", today).zone, "ideal");
  const extended = D.editHabit(
    changed,
    "wake",
    { name: "Get up", from: "2026-10-31", limit: 490 },
    today
  );
  assert.equal(D.dayResult(extended.habits[0], "2026-10-31", today).kind, "failure");
  assert.equal(D.limitForDate(extended.habits[0], "2026-11-03"), 480);
});

test("an earlier-time plan preserves goal type and exact target; cancellation keeps elapsed stages", () => {
  let state = fixture();
  const input = { first: "2026-11-08", everyDays: 2, decrease: 10, target: 465 };
  const preview = D.reductionPreview(state.habits[0], input, today);
  assert.deepEqual(
    preview.map((s) => [s.from, s.value, s.goal]),
    [
      ["2026-11-08", 470, "by-time"],
      ["2026-11-10", 465, "by-time"]
    ]
  );
  state = D.scheduleReduction(state, "wake", input, today);
  assert.equal(D.limitForDate(state.habits[0], today), 480);
  assert.equal(D.limitForDate(state.habits[0], "2026-11-09"), 470);
  state = D.cancelReduction(state, "wake", "2026-11-09");
  assert.deepEqual(
    state.habits[0].limits.map((s) => s.value),
    [480, 470]
  );
  assert.throws(() =>
    D.scheduleFrequency(state, "wake", [{ from: "2026-11-11", value: 1, periodDays: 7 }], today)
  );
});

test("time-goal statistics and streaks match daily results with missing and midnight records", () => {
  let state = fixture();
  for (const [date, time] of [
    ["2026-11-01", 0],
    ["2026-11-02", 480],
    ["2026-11-04", 450],
    ["2026-11-05", 500],
    ["2026-11-06", 460],
    [today, 0]
  ]) {
    state = D.setCount(state, "wake", date, time, today);
  }
  const habit = state.habits[0],
    stats = D.statistics(state, "2026-11-01", today, today);
  assert.equal(stats.rows[0].completedDays, 6);
  assert.equal(stats.rows[0].successDays, 4);
  assert.equal(stats.rows[0].exceededDays, 2);
  assert.equal(stats.rows[0].recordedDays, 6);
  assert.equal(stats.rows[0].events, null);
  assert.equal(stats.rows[0].average, null);
  assert.equal(stats.rows[0].today.within, true);
  assert.deepEqual(stats.total.amounts, []);
  assert.deepEqual(D.habitStreak(habit, today, today), { days: 1, idealDays: 1, kind: "active" });
  assert.equal(D.habitProgress(habit, today, today).bestDays, 2);
});

test("sparse clock statistics agree with a daily oracle across changing deadlines", () => {
  for (let seed = 0; seed < 12; seed++) {
    let state = fixture();
    state = D.editHabit(state, "wake", { name: "Get up", from: "2026-11-04", limit: 465 }, today);
    for (let day = 1; day <= 7; day++)
      if ((day + seed) % 3) {
        state = D.setCount(state, "wake", "2026-11-0" + day, (day + seed) % 4 ? 470 : 0, today);
      }
    for (let start = 1; start <= 6; start++) {
      let good = 0;
      for (let day = start; day < 7; day++)
        if (D.dayResult(state.habits[0], "2026-11-0" + day, today).kind === "success") good++;
      const stats = D.statistics(state, "2026-11-0" + start, today, today).rows[0];
      assert.equal(stats.successDays, good);
      assert.equal(stats.exceededDays, 7 - start - good);
    }
  }
});

test("a long empty time history stays sparse and fails even with a zero target", () => {
  const state = fixture({ startDate: "1900-01-01", limit: 0 });
  const row = D.statistics(state, "1900-01-01", "9999-12-31", "9999-12-31").rows[0];
  assert.ok(row.completedDays > 2900000);
  assert.equal(row.successDays, 0);
  assert.equal(row.exceededDays, row.completedDays);
});

test("invalid times, rolling time rules, task links and quantity conversion cannot reinterpret history", () => {
  const state = fixture();
  for (const value of [-1, 1440, 8.5, null, "08:00"]) {
    assert.throws(() => D.setCount(state, "wake", today, value, today));
    assert.throws(() => fixture({ limit: value }));
  }
  assert.throws(() => fixture({ periodDays: 7 }));
  assert.throws(() =>
    D.editHabit(state, "wake", { name: "Get up", from: today, goal: "at-most", limit: 480 }, today)
  );
  const quantity = fixture({ goal: "at-most" });
  assert.throws(() =>
    D.editHabit(
      quantity,
      "wake",
      { name: "Get up", from: today, goal: "by-time", limit: 480 },
      today
    )
  );
  for (const delta of [-1, 1])
    assert.throws(() => D.changeCount(state, "wake", today, delta, today));
  assert.throws(() => D.applyCountInput(state, "wake", today, 1, "add", today));
  const invalid = structuredClone(state);
  invalid.habits[0].counts[today] = 1440;
  assert.throws(() => D.parseState(JSON.stringify(invalid)));
  assert.throws(() => D.setTaskSchedule(state, "wake", { repeatId: "task" }, today));
});

test("clock records survive storage, hidden habits, archives and backup parsing without rewriting", async () => {
  let raw = JSON.stringify(fixture());
  const store = createStore({
    loadSyncedData: async () => raw,
    persistDataSynced: async (value) => {
      raw = value;
    }
  });
  await store.reload();
  await store.mutate((s) => D.setCount(s, "wake", "2026-11-06", 0, today));
  await store.mutate((s) => D.setHabitHidden(s, "wake", true));
  await store.reload();
  assert.equal(store.snapshot().state.habits[0].counts["2026-11-06"], 0);
  const archived = D.archiveHabit(store.snapshot().state, "wake", today);
  assert.equal(D.dayResult(archived.habits[0], "2026-11-06", today).kind, "success");
  assert.equal(JSON.stringify(D.parseState(raw)), raw);
});

test("clock formatting uses HH:MM, keeps missing records distinct and labels completion", () => {
  for (const [text, value] of [
    ["00:00", 0],
    ["07:45", 465],
    ["23:59", 1439]
  ]) {
    assert.equal(D.clockMinutes(text), value);
    assert.equal(D.clockText(value), text);
  }
  for (const text of [null, "", "8:00", "24:00", "08:60", "08:00:30"])
    assert.throws(() => D.clockMinutes(text));
  const result = D.dayResult(fixture().habits[0], today, today);
  assert.equal(countText(result), "—");
  assert.match(usageText(result, "min"), /Not recorded.*08:00/);
  assert.match(resultLabel(result), /not met yet/);
  assert.equal(ruleText(465, 1, "min", "by-time"), "07:45");
  assert.equal(countText({ ...result, recorded: true, count: 0 }), "00:00");
});
