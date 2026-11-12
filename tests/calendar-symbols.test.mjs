import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { calendarSymbol } from "../src/ui/calendar-view.js";

const today = "2026-11-07";
function fixture() {
  return D.createHabit(
    D.emptyState("UTC"),
    {
      name: "Limit",
      limit: 2,
      startDate: "2026-11-01",
      initialCount: 0,
      zones: { enabled: true, idealMax: 0, yellowMax: null, yellowEnabled: true }
    },
    today,
    "limit"
  );
}

test("calendar symbols distinguish ideal, acceptable and failed amounts without color", () => {
  const state = fixture(),
    habit = state.habits[0];
  for (const [count, symbol] of [
    [0, "✦"],
    [1, "✓"],
    [3, "×"]
  ]) {
    habit.counts["2026-11-06"] = count;
    assert.equal(calendarSymbol(D.calendarResult(habit, "2026-11-06", today)), symbol);
  }
  habit.zones.enabled = false;
  assert.equal(calendarSymbol(D.calendarResult(habit, "2026-11-06", today)), "○");
});

test("unmarked check-ins, inactive dates, rest days and future dates have distinct symbols", () => {
  const state = D.createHabit(
    D.emptyState("UTC"),
    {
      name: "Check",
      goal: "at-least",
      tracking: "check-in",
      limit: 1,
      startDate: "2026-11-01",
      initialCount: 0
    },
    today,
    "check"
  );
  const habit = state.habits[0],
    original = JSON.stringify(state);
  const unknown = calendarSymbol(D.calendarResult(habit, "2026-11-06", today));
  const inactive = calendarSymbol(D.calendarResult(habit, "2026-10-31", today));
  const future = calendarSymbol(D.calendarResult(habit, "2026-11-08", today));
  const rest = calendarSymbol({ kind: "rest", zone: "rest" });
  assert.deepEqual([unknown, inactive, future, rest], ["?", "·", "›", "–"]);
  assert.equal(new Set([unknown, inactive, future, rest]).size, 4);
  assert.equal(calendarSymbol({ kind: "future", zone: "rest" }), "–");
  assert.equal(JSON.stringify(state), original);
});

test("an unmarked check-in cannot look failed while explicit outcomes retain their symbols", () => {
  let state = D.createHabit(
    D.emptyState("UTC"),
    {
      name: "Check",
      goal: "at-most",
      tracking: "check-in",
      limit: 1,
      startDate: "2026-11-01",
      initialCount: 0
    },
    today,
    "check"
  );
  assert.equal(calendarSymbol(D.calendarResult(state.habits[0], today, today)), "?");
  for (const [done, symbol] of [
    [true, "✦"],
    [false, "×"]
  ]) {
    state = D.setCompletion(state, "check", today, done, today);
    assert.equal(calendarSymbol(D.calendarResult(state.habits[0], today, today)), symbol);
  }
});
