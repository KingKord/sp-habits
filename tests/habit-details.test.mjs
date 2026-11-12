import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { habitDetails, DETAIL_PAGE_SIZE } from "../src/habit-details.js";
import { detailRuleText } from "../src/ui/habit-details.js";
import { fixedSchedule } from "../src/task-integration.js";

const today = "2026-11-12";
function fixture() {
  return D.createHabit(
    D.emptyState("UTC"),
    {
      name: "Reading",
      unit: "min",
      goal: "at-least",
      limit: 20,
      periodDays: 3,
      startDate: "2026-11-01",
      initialCount: 0
    },
    today,
    "habit"
  );
}

test("detail rows separate daily amounts from rolling assessments and retain dated rules", () => {
  let state = fixture();
  state.habits[0].counts = { "2026-11-01": 20, "2026-11-03": 5, "2026-11-12": 30 };
  state = D.editHabit(
    state,
    "habit",
    { name: "Reading", goal: "at-least", limit: 30, periodDays: 3, from: "2026-11-05" },
    today
  );
  const raw = D.encodeState(state),
    data = habitDetails(state, "habit", "2026-11-03", today, today);
  const old = data.rows.find((row) => row.date === "2026-11-03");
  assert.equal(old.count, 5);
  assert.equal(old.periodCount, 25);
  assert.equal(old.limit, 20);
  assert.equal(old.kind, "success");
  assert.equal(data.rows.find((row) => row.date === "2026-11-05").limit, 30);
  assert.deepEqual(
    data.rules.map((rule) => rule.from),
    ["2026-11-05", "2026-11-01"]
  );
  assert.equal(
    data.statistics.events,
    35,
    "range totals exclude quantities before the selected range"
  );
  assert.equal(data.statistics.completedDays, 9, "today remains provisional");
  assert.equal(D.encodeState(state), raw);
});

test("unknown check-ins remain unknown, with explicit marks, notes and today handled separately", () => {
  let state = D.createHabit(
    D.emptyState("UTC"),
    {
      name: "Wake",
      goal: "at-most",
      tracking: "check-in",
      deadline: 480,
      limit: 1,
      initialCount: 0,
      startDate: "2026-11-01"
    },
    today,
    "check"
  );
  state = D.setCompletion(state, "check", "2026-11-02", true, today);
  state = D.setCompletion(state, "check", "2026-11-03", false, today);
  state = D.setCompletion(state, "check", today, true, today);
  state = D.setNote(state, "check", "2026-11-04", "An unknown day with context", today);
  const data = habitDetails(state, "check", "2026-11-01", today, today);
  const unknown = data.rows.find((row) => row.date === "2026-11-04");
  assert.equal(unknown.recorded, false);
  assert.equal(unknown.zone, "neutral");
  assert.equal(data.statistics.unmarkedDays, 9);
  assert.equal(data.statistics.successRate, 0.5);
  assert.equal(data.rows[0].kind, "today-good");
  assert.equal(detailRuleText(data.habit, data.rules[0]), "No later than 08:00");
});

test("centuries of daily history and many rule boundaries are paginated without expanding every day", () => {
  const state = fixture(),
    habit = state.habits[0];
  habit.startDate = "1900-01-01";
  habit.limits = Array.from({ length: 100 }, (_, index) => ({
    from: D.addDays("1900-01-01", index * 100),
    value: index + 1,
    goal: "at-least"
  }));
  const data = habitDetails(state, "habit", "1900-01-01", today, today);
  assert.equal(data.rows.length, DETAIL_PAGE_SIZE);
  assert.equal(data.rules.length, DETAIL_PAGE_SIZE);
  assert.ok(data.pages > 1000);
  assert.equal(data.rulePages, 4);
  const oldest = habitDetails(state, "habit", "1900-01-01", today, today, data.pages - 1, 3);
  assert.equal(oldest.rows.at(-1).date, "1900-01-01");
  assert.equal(oldest.rules.at(-1).from, "1900-01-01");
  assert.equal(
    habitDetails(state, "habit", "1900-01-01", today, today, 100000).page,
    data.pages - 1
  );
  assert.throws(() => habitDetails(state, "habit", today, "2026-11-13", today));
  assert.throws(() => habitDetails(state, "habit", today, today, today, -1));
});

test("archive boundaries, hidden habits and linked-task rest days use the shared domain results", () => {
  let state = D.createHabit(
    D.emptyState("UTC"),
    { name: "Task", goal: "at-least", limit: 1, initialCount: 0, startDate: "2026-11-01" },
    today,
    "task"
  );
  const schedule = fixedSchedule({
    id: "series",
    title: "Task",
    repeatCycle: "DAILY",
    repeatEvery: 2,
    startDate: "2026-11-01",
    startTime: null
  });
  state = D.setTaskSchedule(state, "task", schedule, "2026-11-01");
  state = D.setHabitHidden(state, "task", true);
  const data = habitDetails(state, "task", "2026-11-01", today, today);
  assert.equal(data.habit.hidden, true);
  assert.equal(data.rows.find((row) => row.date === "2026-11-02").kind, "rest");
  assert.equal(data.rows.find((row) => row.date === "2026-11-03").readOnly, true);
  const archived = D.archiveHabit(state, "task", "2026-11-05");
  const history = habitDetails(archived, "task", "2026-11-01", today, today);
  assert.equal(history.rows.find((row) => row.date === "2026-11-06").kind, "inactive");
  assert.equal(history.statistics.to, "2026-11-05");
});
