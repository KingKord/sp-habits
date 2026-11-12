import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { resultLabel, usageText, checkInSymbol, resultClass } from "../src/ui/format.js";
import { calendarSymbol } from "../src/ui/calendar-view.js";
import { createDayView } from "../src/ui/day-view.js";
import { fieldsHarness } from "./fixtures/ui-fields.mjs";

function fixture(type = "quantity", tracking = "quantity", startDate = "2026-11-02") {
  return D.createHabit(
    D.emptyState("Europe/Moscow"),
    {
      name: "Practice",
      goal: "at-least",
      tracking,
      limit: 1,
      initialCount: 0,
      startDate,
      weekGoal: { type, target: 3, weekStart: 0 }
    },
    "2026-11-30",
    "practice"
  );
}
const count = (state, date, value) => D.setCount(state, "practice", date, value, "2026-11-30");

test("calendar weekly quantities reset on Monday and distinct days cannot be earned by repeated same-day increments", () => {
  for (const type of ["quantity", "days"]) {
    const state = count(fixture(type), "2026-11-02", 3),
      habit = state.habits[0];
    const result = D.dayResult(habit, "2026-11-08", "2026-11-09");
    assert.equal(result.weekly.progress, type === "quantity" ? 3 : 1);
    assert.equal(result.weekly.met, type === "quantity");
    assert.equal(D.dayResult(habit, "2026-11-09", "2026-11-09").weekly.progress, 0);
    const row = D.statistics(state, "2026-11-02", "2026-11-08", "2026-11-09").rows[0];
    assert.equal(row.completedDays, 1);
    assert.equal(row.assessmentUnit, "weeks");
    assert.equal(row.successRate, type === "quantity" ? 1 : 0);
    assert.equal(
      D.habitProgress(habit, "2026-11-09", "2026-11-09").days,
      type === "quantity" ? 1 : 0
    );
    assert.equal(D.habitProgress(habit, "2026-11-09", "2026-11-09").unit, "weeks");
    assert.deepEqual(D.parseBackup(D.encodeState(state)), state);
  }
});

test("partial first, final, changed-rule and selected-range weeks show progress without assessment", () => {
  let state = count(fixture("quantity", "quantity", "2026-11-04"), "2026-11-04", 3);
  const result = D.calendarResult(state.habits[0], "2026-11-08", "2026-11-09");
  assert.equal(result.weekly.partial, true);
  assert.equal(result.weekly.progress, 3);
  assert.equal(result.zone, "neutral");
  assert.equal(resultLabel(result), "Partial week · progress only");
  assert.match(usageText(result, "times"), /3 \/ 3/);
  assert.equal(
    D.statistics(state, "2026-11-04", "2026-11-08", "2026-11-09").rows[0].successRate,
    null
  );
  state = count(state, "2026-11-09", 3);
  state = D.editHabit(
    state,
    "practice",
    {
      name: "Practice",
      limit: 1,
      from: "2026-11-11",
      weekGoal: { type: "quantity", target: 4, weekStart: 0 }
    },
    "2026-11-30"
  );
  assert.equal(D.dayResult(state.habits[0], "2026-11-12", "2026-11-16").weekly.partial, true);
  const full = count(fixture(), "2026-11-02", 3);
  assert.equal(
    D.statistics(full, "2026-11-03", "2026-11-08", "2026-11-09").rows[0].successRate,
    null
  );
  const archived = D.archiveHabit(count(full, "2026-11-09", 3), "practice", "2026-11-11");
  const row = D.statistics(archived, "2026-11-02", "2026-11-15", "2026-11-16").rows[0];
  assert.equal(row.weekly.completed, 1);
  assert.equal(row.weekly.partial, 1);
  assert.equal(row.successRate, 1);
});

test("weekly check-in goals keep unknown weeks separate and paused weeks do not break a confirmed weekly streak", () => {
  let state = fixture("days", "check-in");
  state = count(state, "2026-11-02", 1);
  let row = D.statistics(state, "2026-11-02", "2026-11-08", "2026-11-09").rows[0];
  assert.equal(row.weekly.unknown, 1);
  assert.equal(D.calendarResult(state.habits[0], "2026-11-02", "2026-11-09").zone, "ideal");
  assert.equal(row.successRate, null);
  assert.equal(row.exceededDays, 0);
  for (const date of ["2026-11-03", "2026-11-04"]) state = count(state, date, 1);
  row = D.statistics(state, "2026-11-02", "2026-11-08", "2026-11-09").rows[0];
  assert.equal(row.successRate, 1);
  state = D.editHabit(
    state,
    "practice",
    {
      name: "Practice",
      limit: 1,
      from: "2026-11-02",
      pauses: [{ from: "2026-11-09", to: "2026-11-15" }]
    },
    "2026-11-30"
  );
  const progress = D.habitProgress(state.habits[0], "2026-11-16", "2026-11-16");
  assert.equal(progress.days, 1);
});

test("weekly validation rejects invalid targets, unsupported directions and non-Monday boundaries without changing old rolling rules", () => {
  for (const weekGoal of [
    { type: "days", target: 8, weekStart: 0 },
    { type: "quantity", target: 0, weekStart: 0 },
    { type: "days", target: 3, weekStart: 1 }
  ]) {
    const state = fixture();
    state.habits[0].limits[0].weekGoal = weekGoal;
    assert.throws(() => D.parseState(JSON.stringify(state)), /Invalid limit/);
  }
  const state = fixture();
  state.habits[0].limits[0].goal = "at-most";
  assert.throws(() => D.validateState(state), /Invalid limit/);
  const rolling = D.createHabit(
    D.emptyState("Europe/Moscow"),
    {
      name: "Rolling",
      goal: "at-least",
      limit: 3,
      initialCount: 0,
      startDate: "2026-11-01",
      periodDays: 7
    },
    "2026-11-09",
    "rolling"
  );
  const changed = D.setCount(rolling, "rolling", "2026-11-08", 3, "2026-11-09");
  assert.equal(D.dayResult(changed.habits[0], "2026-11-09", "2026-11-09").periodCount, 3);
  assert.equal(D.dayResult(changed.habits[0], "2026-11-09", "2026-11-09").weekly, undefined);
});

test("statistics do not combine daily and weekly assessment units into a rate", () => {
  let state = count(fixture(), "2026-11-02", 3);
  state = D.createHabit(
    state,
    { name: "Daily", goal: "at-least", limit: 1, initialCount: 0, startDate: "2026-11-02" },
    "2026-11-09",
    "daily"
  );
  const data = D.statistics(state, "2026-11-02", "2026-11-08", "2026-11-09");
  assert.equal(data.total.assessmentUnit, "mixed");
  assert.equal(data.total.successRate, null);
  assert.equal(data.rows[0].successRate, 1);
});

test("weekly check-in history keeps each daily Done, Missed and unknown mark when the weekly target is met", () => {
  let state = fixture("days", "check-in");
  for (const date of ["2026-11-02", "2026-11-03", "2026-11-04"]) state = count(state, date, 1);
  state = count(state, "2026-11-05", 0);
  const habit = state.habits[0];
  for (const [date, symbol, calendar, zone, css, label] of [
    ["2026-11-02", "✓", "✓", "ideal", "good", "Done · Weekly goal met"],
    ["2026-11-05", "×", "×", "red", "bad", "Missed · Weekly goal met"],
    ["2026-11-06", "—", "?", "neutral", "inactive", "Not marked · Weekly goal met"]
  ]) {
    const result = D.calendarResult(habit, date, "2026-11-09");
    assert.equal(result.weekly.met, true);
    assert.equal(checkInSymbol(result), symbol);
    assert.equal(calendarSymbol(result), calendar);
    assert.equal(result.zone, zone);
    assert.equal(resultClass(result), css);
    assert.equal(resultLabel(result), label);
    assert.match(usageText(result, "times"), /3 \/ 3 successful days/);
  }
});

test("a successful daily check-in stays successful inside a failed or unknown weekly goal", () => {
  let state = count(fixture("days", "check-in"), "2026-11-02", 1);
  for (const date of [
    "2026-11-03",
    "2026-11-04",
    "2026-11-05",
    "2026-11-06",
    "2026-11-07",
    "2026-11-08"
  ])
    state = count(state, date, 0);
  const result = D.calendarResult(state.habits[0], "2026-11-02", "2026-11-09");
  assert.equal(result.weekly.met, false);
  assert.equal(result.weekly.unknown, false);
  assert.equal(result.kind, "failure");
  assert.equal(checkInSymbol(result), "✓");
  assert.equal(calendarSymbol(result), "✓");
  assert.equal(result.zone, "ideal");
  assert.equal(resultClass(result), "good");
  assert.equal(resultLabel(result), "Done · Weekly goal not met");
  const unknown = D.calendarResult(
    count(fixture("days", "check-in"), "2026-11-02", 1).habits[0],
    "2026-11-02",
    "2026-11-09"
  );
  assert.equal(unknown.weekly.unknown, true);
  assert.equal(unknown.zone, "ideal");
  assert.equal(resultLabel(unknown), "Done · Week has unmarked days");
});

test("weekly quantity distinct-day goals require a positive daily minimum while daily and rolling zero goals remain readable", () => {
  const invalid = fixture("days");
  invalid.habits[0].limits[0].value = 0;
  assert.throws(() => D.parseState(JSON.stringify(invalid)), /Invalid limit/);
  for (const periodDays of [1, 7]) {
    const state = D.createHabit(
      D.emptyState("UTC"),
      {
        name: "Existing zero goal",
        goal: "at-least",
        limit: 0,
        initialCount: 0,
        periodDays,
        startDate: "2026-11-02"
      },
      "2026-11-09",
      "zero"
    );
    const restored = D.parseState(JSON.stringify(state));
    assert.equal(D.dayResult(restored.habits[0], "2026-11-08", "2026-11-09").kind, "success");
  }
});

test("the rendered Day history uses explicit marks and keeps the weekly check-in deadline visible", () => {
  let state = fixture("days", "check-in");
  state.habits[0].limits[0].deadline = 480;
  for (const date of ["2026-11-02", "2026-11-03", "2026-11-04"]) state = count(state, date, 1);
  state = count(state, "2026-11-05", 0);
  const h = fieldsHarness([
    "arrange",
    "arrange-hint",
    "active",
    "hidden",
    "archived",
    "date",
    "prev",
    "next",
    "today",
    "zone",
    "summary",
    "cards",
    "organization"
  ]);
  const originalNode = h.dom.node;
  h.dom.node = (tag, text, className) => {
    const element = originalNode(tag, text);
    Object.assign(element, { className, dataset: {}, style: {}, getAttribute: () => null });
    return element;
  };
  h.dom.button = (text, action, label, className) => {
    const element = h.dom.node("button", text, className);
    element.addEventListener("click", action);
    element.getAttribute = (name) => (name === "aria-label" ? label : null);
    return element;
  };
  Object.assign(h.dom, {
    fragment: () => h.dom.node("fragment"),
    on: () => {},
    activeElement: () => null,
    restoreFocus: () => {}
  });
  const snapshot = { state, pending: 0, blocked: false, busyRead: false };
  const day = createDayView({
    dom: h.dom,
    store: { snapshot: () => snapshot },
    now: () => "2026-11-08"
  });
  day.prepare("2026-11-08");
  day.render(snapshot, "2026-11-08");
  const marker = (date) =>
    h.elements.find((element) => element.dataset?.focusKey === "practice-" + date);
  assert.equal(marker("2026-11-02").children[0].textContent, "✓");
  assert.equal(marker("2026-11-05").children[0].textContent, "×");
  assert.match(marker("2026-11-05").className, /bad/);
  assert.equal(marker("2026-11-06").children[0].textContent, "—");
  const rule = h.elements.find((element) => element.className === "habit-rule");
  assert.match(rule.textContent, /3 successful days per calendar week/);
  assert.match(rule.textContent, /No later than 08:00/);
  assert.match(rule.title, /3 successful days per calendar week/);
  assert.match(rule.title, /No later than 08:00/);
});
