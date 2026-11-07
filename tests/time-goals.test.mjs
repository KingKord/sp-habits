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
      goal: "before-time",
      limit: 480,
      unit: "times",
      step: 1,
      startDate: "2026-11-01",
      initialCount: 0,
      ...overrides
    },
    today,
    "wake"
  );
}

test("a time target uses a manual Done or Missed mark, never an inferred wake-up time", () => {
  const state = fixture(),
    habit = state.habits[0];
  assert.equal(D.dayResult(habit, today, today).kind, "today-bad");
  assert.equal(D.dayResult(habit, today, today).recorded, false);
  assert.equal(D.calendarResult(habit, "2026-11-06", today).zone, "neutral");
  for (const [done, kind, zone, count] of [
    [true, "success", "ideal", 1],
    [false, "failure", "red", 0]
  ]) {
    const changed = D.setCompletion(state, "wake", "2026-11-06", done, today);
    const result = D.calendarResult(changed.habits[0], "2026-11-06", today);
    assert.equal(result.kind, kind);
    assert.equal(result.zone, zone);
    assert.equal(result.recorded, true);
    assert.equal(result.count, count);
    assert.deepEqual(habit.counts, {});
  }
  assert.equal(D.dayResult(habit, "2026-10-31", today).kind, "inactive");
  assert.equal(D.dayResult(habit, "2026-11-08", today).kind, "future");
});

test("undo restores an unmarked day and midnight is a target, not a recorded completion", () => {
  let state = fixture({ limit: 0 });
  state = D.setCompletion(state, "wake", today, true, today);
  assert.equal(D.dayResult(state.habits[0], today, today).kind, "today-good");
  state = D.setCompletion(state, "wake", today, null, today);
  assert.equal(D.dayResult(state.habits[0], today, today).recorded, false);
  assert.equal(D.dayResult(state.habits[0], today, today).kind, "today-bad");
  assert.throws(() => D.setCompletion(state, "wake", "2026-11-08", true, today));
});

test("dated target changes and earlier tracking preserve completion marks and earlier rules", () => {
  let state = D.setCompletion(fixture(), "wake", "2026-11-03", true, today);
  state = D.setCompletion(state, "wake", "2026-11-06", true, today);
  const changed = D.editHabit(
    state,
    "wake",
    { name: "Get up", from: "2026-11-05", limit: 465 },
    today
  );
  assert.deepEqual(changed.habits[0].counts, state.habits[0].counts);
  assert.equal(D.limitForDate(changed.habits[0], "2026-11-03"), 480);
  assert.equal(D.limitForDate(changed.habits[0], "2026-11-06"), 465);
  assert.equal(D.dayResult(changed.habits[0], "2026-11-06", today).kind, "success");
  const extended = D.editHabit(
    changed,
    "wake",
    { name: "Get up", from: "2026-10-31", limit: 490 },
    today
  );
  assert.equal(D.dayResult(extended.habits[0], "2026-10-31", today).kind, "failure");
  assert.equal(D.limitForDate(extended.habits[0], "2026-11-03"), 480);
});

test("an earlier-time plan preserves the completion goal and cancellation keeps elapsed stages", () => {
  const input = { first: "2026-11-08", everyDays: 2, decrease: 10, target: 465 };
  let state = fixture();
  assert.deepEqual(
    D.reductionPreview(state.habits[0], input, today).map((s) => [s.from, s.value, s.goal]),
    [
      ["2026-11-08", 470, "before-time"],
      ["2026-11-10", 465, "before-time"]
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

test("statistics sum completions while missed and missing days break completed-day streaks", () => {
  let state = fixture();
  for (const [date, done] of [
    ["2026-11-01", true],
    ["2026-11-02", true],
    ["2026-11-04", true],
    ["2026-11-05", false],
    ["2026-11-06", true],
    [today, true]
  ])
    state = D.setCompletion(state, "wake", date, done, today);
  const habit = state.habits[0],
    stats = D.statistics(state, "2026-11-01", today, today);
  assert.equal(stats.rows[0].completedDays, 6);
  assert.equal(stats.rows[0].successDays, 4);
  assert.equal(stats.rows[0].exceededDays, 2);
  assert.equal(stats.rows[0].events, 5);
  assert.equal(stats.rows[0].today.within, true);
  assert.deepEqual(stats.total.amounts, [{ unit: "times", value: 5 }]);
  assert.deepEqual(D.habitStreak(habit, today, today), { days: 1, idealDays: 1, kind: "active" });
  assert.equal(D.habitProgress(habit, today, today).bestDays, 2);
});

test("sparse statistics match recorded completion marks across changing clock targets", () => {
  for (let seed = 0; seed < 12; seed++) {
    let state = D.editHabit(
      fixture(),
      "wake",
      { name: "Get up", from: "2026-11-04", limit: 465 },
      today
    );
    for (let day = 1; day <= 7; day++)
      if ((day + seed) % 3)
        state = D.setCompletion(state, "wake", "2026-11-0" + day, (day + seed) % 4 !== 0, today);
    for (let start = 1; start <= 6; start++) {
      let success = 0;
      for (let day = start; day < 7; day++)
        if (state.habits[0].counts["2026-11-0" + day] === 1) success++;
      const row = D.statistics(state, "2026-11-0" + start, today, today).rows[0];
      assert.equal(row.successDays, success);
      assert.equal(row.exceededDays, 7 - start - success);
    }
  }
});

test("a long empty completion history stays sparse and never succeeds without a mark", () => {
  const state = fixture({ startDate: "1900-01-01", limit: 0 });
  const row = D.statistics(state, "1900-01-01", "9999-12-31", "9999-12-31").rows[0];
  assert.ok(row.completedDays > 2900000);
  assert.equal(row.successDays, 0);
  assert.equal(row.exceededDays, row.completedDays);
});

test("clock-minute records, malformed targets and quantity conversions cannot be mistaken for marks", () => {
  const state = fixture();
  for (const value of [-1, 2, 480, 1440, 0.5, null, "08:00"])
    assert.throws(() => D.setCount(state, "wake", today, value, today));
  for (const limit of [-1, 1440, 8.5, null, "08:00"]) assert.throws(() => fixture({ limit }));
  for (const done of [0, 1, "done", undefined])
    assert.throws(() => D.setCompletion(state, "wake", today, done, today));
  assert.throws(() => fixture({ periodDays: 7 }));
  assert.throws(() => fixture({ unit: "min" }));
  assert.throws(() =>
    D.editHabit(state, "wake", { name: "Get up", from: today, goal: "at-most", limit: 480 }, today)
  );
  assert.throws(() =>
    D.editHabit(
      fixture({ goal: "at-most" }),
      "wake",
      { name: "Get up", from: today, goal: "before-time", limit: 480 },
      today
    )
  );
  for (const delta of [-1, 1])
    assert.throws(() => D.changeCount(state, "wake", today, delta, today));
  const invalid = structuredClone(state);
  invalid.habits[0].counts[today] = 480;
  assert.throws(() => D.parseState(JSON.stringify(invalid)));
  invalid.habits[0].counts[today] = 0;
  invalid.habits[0].limits[0].goal = "by-time";
  assert.throws(() => D.parseState(JSON.stringify(invalid)));
  assert.throws(() => D.setTaskSchedule(state, "wake", { repeatId: "task" }, today));
});

test("marks survive storage, hiding, archiving and backup parsing without read-time changes", async () => {
  let raw = JSON.stringify(fixture());
  const store = createStore({
    loadSyncedData: async () => raw,
    persistDataSynced: async (value) => {
      raw = value;
    }
  });
  await store.reload();
  await store.mutate((s) => D.setCompletion(s, "wake", "2026-11-06", true, today));
  await store.mutate((s) => D.setHabitHidden(s, "wake", true));
  await store.reload();
  assert.equal(store.snapshot().state.habits[0].counts["2026-11-06"], 1);
  const archived = D.archiveHabit(store.snapshot().state, "wake", today);
  assert.equal(D.dayResult(archived.habits[0], "2026-11-06", today).kind, "success");
  assert.equal(JSON.stringify(D.parseState(raw)), raw);
});

test("formatting separates a clock target from Done, Missed and unmarked daily results", () => {
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
  assert.equal(countText(result), "Not marked");
  assert.match(usageText(result, "times"), /Not marked.*No later than 08:00/);
  assert.equal(ruleText(465, 1, "times", "before-time"), "07:45");
  assert.equal(countText({ ...result, recorded: true, count: 1 }), "Done");
  assert.equal(countText({ ...result, recorded: true, count: 0 }), "Missed");
  assert.match(resultLabel({ ...result, recorded: true, count: 1 }), /Done.*day in progress/);
});
