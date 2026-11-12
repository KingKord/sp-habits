import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { scheduleDescription } from "../src/ui/schedule-fields.js";

function fixture(manualSchedule, tracking = "quantity") {
  return D.createHabit(
    D.emptyState("Europe/Moscow"),
    {
      name: "Practice",
      goal: "at-least",
      limit: 1,
      initialCount: 0,
      startDate: "2026-11-01",
      tracking,
      manualSchedule
    },
    "2026-11-12",
    "practice"
  );
}

test("weekday rest days preserve streaks and totals without entering assessment denominators", () => {
  for (const tracking of ["quantity", "check-in"]) {
    let state = fixture({ type: "weekdays", days: [0, 2, 4] }, tracking);
    for (const date of ["2026-11-02", "2026-11-04", "2026-11-06", "2026-11-07"])
      state = D.setCount(state, "practice", date, 1, "2026-11-08");
    const habit = state.habits[0];
    assert.equal(D.dayResult(habit, "2026-11-07", "2026-11-08").kind, "rest");
    assert.equal(D.habitStreak(habit, "2026-11-08", "2026-11-08").days, 3);
    const row = D.statistics(state, "2026-11-01", "2026-11-07", "2026-11-08").rows[0];
    assert.equal(row.completedDays, 3);
    assert.equal(row.successDays, 3);
    assert.equal(row.events, 4);
    assert.equal(row.successRate, 1);
    assert.equal(scheduleDescription(habit, "2026-11-08"), "Mon, Wed, Fri");
    assert.deepEqual(D.parseBackup(D.encodeState(state)), state);
  }
});

test("interval anchors and dated changes preserve earlier assessments through leap and year boundaries", () => {
  let state = fixture({ type: "interval", every: 2, anchor: "2026-11-02" });
  const original = JSON.stringify(state);
  state = D.editHabit(
    state,
    "practice",
    {
      name: "Practice",
      limit: 1,
      from: "2026-11-06",
      manualSchedule: { type: "weekdays", days: [4] }
    },
    "2026-11-12"
  );
  const habit = state.habits[0];
  assert.equal(D.assessedDays(habit, "2026-11-01", "2026-11-05"), 2);
  assert.equal(D.dayResult(habit, "2026-11-04", "2026-11-12").scheduled, true);
  assert.equal(D.dayResult(habit, "2026-11-08", "2026-11-12").scheduled, false);
  assert.notEqual(JSON.stringify(state), original);
  const leap = {
    ...habit,
    startDate: "2024-02-28",
    manualSchedules: [{ from: "2024-02-28", type: "interval", every: 2, anchor: "2024-02-28" }]
  };
  assert.equal(D.assessedDays(leap, "2024-02-28", "2024-03-01"), 2);
  assert.equal(
    D.assessedDays(leap, "2024-12-30", "2025-01-03"),
    ["2024-12-30", "2024-12-31", "2025-01-01", "2025-01-02", "2025-01-03"].filter((date) =>
      D.assessedDays(leap, date, date)
    ).length
  );
});

test("legacy daily storage stays unchanged and malformed manual schedules cannot be imported", () => {
  const state = fixture(undefined),
    raw = D.encodeState(state);
  assert.equal(D.encodeState(D.parseState(raw)), raw);
  assert.equal(state.habits[0].manualSchedules, undefined);
  for (const schedule of [
    null,
    { type: "weekdays", days: [] },
    { type: "weekdays", days: [2, 2] },
    { type: "weekdays", days: [7] },
    { type: "interval", every: 0, anchor: "2026-11-01" },
    { type: "interval", every: 2, anchor: "invalid" },
    { type: "monthly" }
  ]) {
    const invalid = structuredClone(state);
    invalid.habits[0].manualSchedules = [{ ...schedule, from: "2026-11-01" }];
    assert.throws(() => D.parseState(JSON.stringify(invalid)), /manual schedule/);
  }
});

test("arithmetic weekday counts agree with individual dates across schedule changes and DST", () => {
  const state = fixture({ type: "weekdays", days: [0, 3, 6] });
  const habit = state.habits[0];
  habit.startDate = habit.limits[0].from = "2026-03-01";
  habit.manualSchedules = [
    { from: "2026-03-01", type: "weekdays", days: [0, 3, 6] },
    { from: "2026-03-29", type: "interval", every: 3, anchor: "2026-03-28" }
  ];
  const dates = Array.from({ length: 65 }, (_, i) => D.addDays("2026-03-01", i));
  assert.equal(
    D.assessedDays(habit, dates[0], dates.at(-1)),
    dates.reduce((sum, date) => sum + D.assessedDays(habit, date, date), 0)
  );
  assert.equal(D.todayInZone("Europe/Berlin", new Date("2026-03-29T00:30:00Z")), "2026-03-29");
});

test("archiving freezes manual schedule history and removes future schedule changes", () => {
  const state = fixture({ type: "weekdays", days: [0, 2, 4] });
  state.habits[0].manualSchedules.push({ from: "2026-12-01", type: "daily" });
  const archived = D.archiveHabit(state, "practice", "2026-11-12").habits[0];
  assert.equal(archived.manualSchedules.length, 1);
  assert.equal(D.dayResult(archived, "2026-11-13", "2026-11-14").kind, "inactive");
});
