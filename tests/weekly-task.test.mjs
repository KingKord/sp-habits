import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { fixedSchedule, reconcileTasks } from "../src/task-integration.js";
import { linkedScheduleDescription } from "../src/ui/schedule-fields.js";

const config = (extra = {}) => ({
  id: "weekly",
  title: "Practice",
  repeatCycle: "WEEKLY",
  repeatEvery: 2,
  startDate: "2026-01-07",
  monday: true,
  friday: true,
  ...extra
});
function linked(cfg, from = cfg.startDate) {
  const state = D.createHabit(
    D.emptyState("Europe/Moscow"),
    { name: "Practice", goal: "at-least", limit: 1, initialCount: 0, startDate: from },
    from,
    "practice"
  );
  return D.setTaskSchedule(state, "practice", fixedSchedule(cfg), from);
}

// Independent per-date oracle from the tagged host's WEEKLY branch and
// getDiffInWeeks: local midnight difference is rounded before flooring / 7.
// https://github.com/super-productivity/super-productivity/blob/v19.3.1/src/app/features/task-repeat-cfg/store/get-newest-possible-due-date.util.ts
// https://github.com/super-productivity/super-productivity/blob/v20.0.0/src/app/features/task-repeat-cfg/store/get-newest-possible-due-date.util.ts
// https://github.com/super-productivity/super-productivity/blob/v20.0.0/src/app/util/get-diff-in-weeks.ts
function hostDue(cfg, date) {
  const parse = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  };
  const start = parse(cfg.startDate),
    current = parse(date);
  const diffDays = Math.round((current - start) / 86400000);
  const key = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
    current.getDay()
  ];
  return (
    date >= cfg.startDate &&
    (!cfg.repeatUntilDay || date <= cfg.repeatUntilDay) &&
    !cfg.isPaused &&
    Math.floor(diffDays / 7) % cfg.repeatEvery === 0 &&
    cfg[key] === true &&
    !(cfg.deletedInstanceDates ?? []).includes(date)
  );
}

test("weekly task dates use start-date week blocks rather than Monday calendar weeks", () => {
  const cfg = config(),
    habit = linked(cfg).habits[0];
  const dates = Array.from({ length: 35 }, (_, index) => D.addDays(cfg.startDate, index));
  assert.deepEqual(
    dates.filter((date) => D.assessedDays(habit, date, date)),
    ["2026-01-09", "2026-01-12", "2026-01-23", "2026-01-26", "2026-02-06", "2026-02-09"]
  );
  assert.equal(linkedScheduleDescription(fixedSchedule(cfg)), "Mon, Fri · every 2 weeks");
});

test("arithmetic weekly assessment matches the tagged host oracle across DST, leap and year boundaries", () => {
  const previous = process.env.TZ;
  process.env.TZ = "Europe/Berlin";
  try {
    for (const startDate of ["2024-02-27", "2026-03-25", "2026-10-21", "2026-12-30"])
      for (const repeatEvery of [1, 2, 3, 7]) {
        const cfg = config({
          startDate,
          repeatEvery,
          wednesday: true,
          repeatUntilDay: D.addDays(startDate, 75),
          deletedInstanceDates: [D.addDays(startDate, 9), D.addDays(startDate, 23)]
        });
        const habit = linked(cfg).habits[0],
          dates = Array.from({ length: 90 }, (_, index) => D.addDays(startDate, index));
        for (const date of dates)
          assert.equal(D.assessedDays(habit, date, date), Number(hostDue(cfg, date)), date);
        assert.equal(
          D.assessedDays(habit, dates[0], dates.at(-1)),
          dates.filter((date) => hostDue(cfg, date)).length
        );
      }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("weekly completion, undo and schedule changes remain idempotent and preserve prior schedules", () => {
  const cfg = config({ startDate: "2026-11-02", repeatEvery: 1 }),
    task = {
      id: "task",
      repeatCfgId: "weekly",
      isDone: true,
      doneOn: Date.parse("2026-11-02T12:00:00Z")
    };
  let state = reconcileTasks(linked(cfg), [task], { weekly: cfg }, "2026-11-02");
  const raw = D.encodeState(state);
  assert.equal(
    D.encodeState(reconcileTasks(state, [task, task], { weekly: cfg }, "2026-11-02")),
    raw
  );
  assert.equal(D.dayResult(state.habits[0], "2026-11-02", "2026-11-03").count, 1);
  const changed = { ...cfg, monday: false, tuesday: true };
  state = reconcileTasks(state, [task], { weekly: changed }, "2026-11-03");
  assert.equal(D.assessedDays(state.habits[0], "2026-11-02", "2026-11-02"), 1);
  assert.equal(D.assessedDays(state.habits[0], "2026-11-03", "2026-11-03"), 1);
  state = reconcileTasks(state, [{ ...task, isDone: false }], { weekly: changed }, "2026-11-03");
  assert.equal(D.dayResult(state.habits[0], "2026-11-02", "2026-11-03").count, 0);
  state = reconcileTasks(state, [], { weekly: { ...changed, isPaused: true } }, "2026-11-04");
  assert.equal(D.assessedDays(state.habits[0], "2026-11-04", "2026-11-30"), 0);
  assert.deepEqual(D.parseBackup(D.encodeState(state)), state);
});

test("weekly config and backup validation reject ambiguous or unsupported recurrence shapes", () => {
  for (const extra of [
    { monday: false, friday: false },
    { monday: "true" },
    { repeatFromCompletionDate: true },
    { waitForCompletion: true },
    { deletedInstanceDates: ["invalid"] },
    { repeatCycle: "MONTHLY" }
  ])
    assert.equal(fixedSchedule(config(extra)), null);
  const daily = fixedSchedule(config({ repeatCycle: "DAILY" }));
  assert.equal(daily.cycle, undefined);
  assert.equal(daily.days, undefined);
  const state = linked(config());
  state.habits[0].taskSchedules[0].days = [0, 0];
  assert.throws(() => D.parseState(JSON.stringify(state)), /task link/);
});
