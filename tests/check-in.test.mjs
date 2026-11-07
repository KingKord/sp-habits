import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { countText, checkInRule, resultClass } from "../src/ui/format.js";

const today = "2026-11-07";
function fixture(goal = "at-least", extra = {}) {
  return D.createHabit(
    D.emptyState("Europe/Moscow"),
    {
      name: "Get up",
      goal,
      tracking: "check-in",
      deadline: null,
      limit: 1,
      initialCount: 0,
      unit: "times",
      step: 1,
      startDate: "2026-11-01",
      ...extra
    },
    today,
    "wake"
  );
}

test("both habit directions use explicit outcomes, with an unknown initial day and reversible marks", () => {
  for (const goal of ["at-least", "at-most"]) {
    let state = fixture(goal);
    const empty = D.calendarResult(state.habits[0], today, today);
    assert.equal(empty.recorded, false);
    assert.equal(empty.zone, "neutral");
    assert.equal(resultClass(empty), "inactive");
    for (const done of [true, false, true]) {
      state = D.setCompletion(state, "wake", today, done, today);
      const result = D.calendarResult(state.habits[0], today, today);
      assert.equal(result.kind, done ? "today-good" : "today-bad");
      assert.equal(result.zone, done ? "ideal" : "red");
      assert.equal(result.recorded, true);
      assert.equal(result.count, done ? 1 : 0);
    }
    state = D.setCompletion(state, "wake", today, null, today);
    assert.deepEqual(state.habits[0].counts, {});
    assert.throws(() => D.setCompletion(state, "wake", "2026-11-08", true, today));
  }
});

test("time conditions are optional and dated changes preserve earlier conditions and marks", () => {
  let state = fixture("at-most", { deadline: 480 });
  state = D.setCompletion(state, "wake", "2026-11-03", true, today);
  state = D.editHabit(
    state,
    "wake",
    {
      name: "Get up",
      tracking: "check-in",
      goal: "at-most",
      limit: 1,
      from: "2026-11-05",
      deadline: 465
    },
    today
  );
  assert.equal(D.deadlineForDate(state.habits[0], "2026-11-03"), 480);
  assert.equal(D.deadlineForDate(state.habits[0], today), 465);
  assert.equal(checkInRule(D.dayResult(state.habits[0], today, today)), "No later than 07:45");
  state = D.editHabit(
    state,
    "wake",
    { name: "Get up", tracking: "check-in", limit: 1, from: today, deadline: null },
    today
  );
  assert.equal(D.deadlineForDate(state.habits[0], today), null);
  assert.equal(checkInRule(D.dayResult(state.habits[0], today, today)), "Daily check-in");
  assert.deepEqual(state.habits[0].counts, { "2026-11-03": 1 });
});

test("negative check-ins label adherence and slips without reversing their success meaning", () => {
  let state = fixture("at-most");
  state = D.setCompletion(state, "wake", today, true, today);
  assert.equal(countText(D.dayResult(state.habits[0], today, today)), "No slip");
  state = D.setCompletion(state, "wake", today, false, today);
  assert.equal(countText(D.dayResult(state.habits[0], today, today)), "Slipped");
});

test("unknown days are shown separately from explicit failures and do not inflate completion rate", () => {
  let state = fixture("at-most");
  state = D.setCompletion(state, "wake", "2026-11-02", true, today);
  state = D.setCompletion(state, "wake", "2026-11-03", false, today);
  const stats = D.statistics(state, "2026-11-01", today, today);
  assert.equal(stats.rows[0].completedDays, 6);
  assert.equal(stats.rows[0].unmarkedDays, 4);
  assert.equal(stats.rows[0].successDays, 1);
  assert.equal(stats.rows[0].exceededDays, 1);
  assert.equal(stats.rows[0].successRate, 0.5);
  assert.equal(stats.total.successRate, 0.5);
  assert.equal(D.habitStreak(state.habits[0], today, today).days, 0);
});

test("check-in validation rejects malformed records, quantity conversions and task links", () => {
  for (const extra of [
    { deadline: 1440 },
    { deadline: "08:00" },
    { limit: 2 },
    { periodDays: 7 },
    { unit: "ml" }
  ])
    assert.throws(() => fixture("at-least", extra));
  const state = fixture();
  assert.throws(() => D.setCount(state, "wake", today, 2, today));
  assert.throws(() => D.changeCount(state, "wake", today, 1, today));
  assert.throws(() =>
    D.editHabit(
      state,
      "wake",
      { name: "Get up", limit: 1, tracking: "quantity", from: today },
      today
    )
  );
  assert.throws(() => D.setTaskSchedule(state, "wake", { repeatId: "task" }, today));
  assert.equal(JSON.stringify(D.parseState(JSON.stringify(state))), JSON.stringify(state));
});

test("saving an earlier time prototype upgrades its conditions without losing completion history", () => {
  let state = D.createHabit(
    D.emptyState("UTC"),
    { name: "Get up", goal: "before-time", limit: 480, initialCount: 0, startDate: "2026-11-01" },
    today,
    "wake"
  );
  state = D.setCompletion(state, "wake", "2026-11-03", true, today);
  state = D.editHabit(
    state,
    "wake",
    { name: "Get up", tracking: "check-in", goal: "at-most", limit: 1, deadline: 465, from: today },
    today
  );
  assert.equal(state.habits[0].limits[0].goal, "at-least");
  assert.equal(D.deadlineForDate(state.habits[0], "2026-11-03"), 480);
  assert.equal(D.goalForDate(state.habits[0], today), "at-most");
  assert.deepEqual(state.habits[0].counts, { "2026-11-03": 1 });
});
