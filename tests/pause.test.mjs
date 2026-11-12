import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { mergePauses } from "../src/scheduling.js";
import { resultLabel } from "../src/ui/format.js";
import { calendarSymbol } from "../src/ui/calendar-view.js";

function fixture(tracking = "quantity", periodDays = 1) {
  return D.createHabit(
    D.emptyState("Europe/Moscow"),
    {
      name: "Practice",
      goal: "at-least",
      tracking,
      limit: 1,
      initialCount: 0,
      periodDays,
      startDate: "2026-11-01"
    },
    "2026-11-12",
    "practice"
  );
}
const edit = (state, pauses) =>
  D.editHabit(
    state,
    "practice",
    {
      name: "Practice",
      limit: 1,
      from: "2026-11-01",
      pauses
    },
    "2026-11-12"
  );

test("paused intervals exclude assessments and preserve marks and streak continuity", () => {
  for (const tracking of ["quantity", "check-in"]) {
    let state = fixture(tracking);
    for (const date of ["2026-11-01", "2026-11-02", "2026-11-04"])
      state = D.setCount(state, "practice", date, 1, "2026-11-12");
    state = edit(state, [{ from: "2026-11-02", to: "2026-11-03" }]);
    const habit = state.habits[0],
      result = D.calendarResult(habit, "2026-11-02", "2026-11-05");
    assert.equal(result.paused, true);
    assert.equal(result.zone, "paused");
    assert.equal(resultLabel(result), "Paused");
    assert.equal(calendarSymbol(result), "⏸");
    assert.equal(D.habitStreak(habit, "2026-11-05", "2026-11-05").days, 2);
    const row = D.statistics(state, "2026-11-01", "2026-11-04", "2026-11-05").rows[0];
    assert.equal(row.completedDays, 2);
    assert.equal(row.successRate, 1);
    assert.equal(row.events, 3);
    assert.equal(habit.counts["2026-11-02"], 1);
    assert.deepEqual(D.parseBackup(D.encodeState(state)), state);
    assert.equal(
      D.calendarResult(edit(state, []).habits[0], "2026-11-02", "2026-11-05").zone,
      "ideal"
    );
  }
});

test("pause overlap normalization and resume boundaries leave rolling quantities intact", () => {
  const pauses = mergePauses([{ from: "2026-11-02", to: "2026-11-04" }], {
    from: "2026-11-03",
    to: null
  });
  assert.deepEqual(pauses, [{ from: "2026-11-02", to: null }]);
  let state = fixture("quantity", 7);
  state = D.setCount(state, "practice", "2026-11-02", 2, "2026-11-12");
  state = edit(state, [{ from: "2026-11-02", to: "2026-11-03" }]);
  assert.equal(D.dayResult(state.habits[0], "2026-11-04", "2026-11-12").periodCount, 2);
  state = edit(state, [{ from: "2026-11-02", to: null }]);
  assert.equal(D.assessedDays(state.habits[0], "2026-11-01", "2026-11-12"), 1);
  const archived = D.archiveHabit(state, "practice", "2026-11-12").habits[0];
  assert.deepEqual(archived.pauses, [{ from: "2026-11-02", to: "2026-11-12" }]);
});

test("invalid pause histories and overlaps with host-owned schedules cannot be imported", () => {
  for (const pauses of [
    null,
    [{ from: "2026-10-31", to: null }],
    [{ from: "2026-11-03", to: "2026-11-02" }],
    [
      { from: "2026-11-02", to: null },
      { from: "2026-11-03", to: null }
    ]
  ])
    assert.throws(() => edit(fixture(), pauses), /pause/);
  const state = fixture();
  state.habits[0].taskSchedules = [
    {
      from: "2026-11-01",
      repeatId: "series",
      anchor: "2026-11-01",
      every: 1,
      title: "Practice",
      time: null,
      paused: false,
      until: null
    }
  ];
  assert.throws(() => edit(state, [{ from: "2026-11-03", to: null }]), /linked task/);
  const raw = D.encodeState(fixture());
  assert.equal(D.encodeState(D.parseState(raw)), raw);
});
