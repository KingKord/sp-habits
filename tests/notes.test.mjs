import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { MAX_NOTE_LENGTH, noteForDate } from "../src/notes.js";
import sample from "./fixtures/i18n/ru.json" with { type: "json" };

const today = "2026-11-12",
  date = "2026-11-11";
const stateFor = (checkIn = false) =>
  D.createHabit(
    D.emptyState("UTC"),
    {
      name: "Reading",
      goal: "at-least",
      limit: 1,
      initialCount: 0,
      startDate: "2026-11-01",
      ...(checkIn ? { tracking: "check-in", deadline: null } : {})
    },
    today,
    "reading"
  );

test("daily note edits are immutable and do not change quantities, unknown check-ins or progress", () => {
  for (const binary of [false, true]) {
    const original = stateFor(binary);
    const result = D.dayResult(original.habits[0], date, today),
      stats = D.statistics(original, date, today, today),
      progress = D.habitProgress(original.habits[0], date, today);
    const written = D.setNote(original, "reading", date, "A useful observation", today);
    assert.equal(original.habits[0].notes, undefined);
    assert.equal(noteForDate(written.habits[0], date), "A useful observation");
    assert.deepEqual(written.habits[0].counts, original.habits[0].counts);
    assert.deepEqual(D.dayResult(written.habits[0], date, today), result);
    assert.deepEqual(D.statistics(written, date, today, today), stats);
    assert.deepEqual(D.habitProgress(written.habits[0], date, today), progress);
    const changed = D.setNote(written, "reading", date, "  Keep spacing\nand a new line.  ", today);
    assert.equal(noteForDate(changed.habits[0], date), "  Keep spacing\nand a new line.  ");
    const removed = D.setNote(changed, "reading", date, " \n ", today);
    assert.deepEqual(removed, original);
  }
});

test("notes preserve other dates and survive hiding, archiving and Unicode backup round trips", () => {
  let state = D.setNote(
    stateFor(true),
    "reading",
    date,
    sample.habitName + " 🌅 <b>plain text</b>",
    today
  );
  state = D.setNote(state, "reading", today, "Second date", today);
  state = D.setNote(state, "reading", today, "", today);
  state = D.setHabitHidden(state, "reading", true);
  state = D.archiveHabit(state, "reading", today);
  const restored = D.parseBackup(D.encodeState(state));
  assert.deepEqual(restored, state);
  assert.equal(noteForDate(restored.habits[0], date), sample.habitName + " 🌅 <b>plain text</b>");
  assert.deepEqual(restored.habits[0].counts, {});
  assert.equal(
    D.setNote(restored, "reading", date, "Updated archive note", today).habits[0].notes[date],
    "Updated archive note"
  );
});

test("old backups are unchanged on read and note edits never touch legacy journal archives", () => {
  const original = stateFor();
  const raw = JSON.stringify(original);
  assert.equal(JSON.stringify(D.parseBackup(raw)), raw);
  for (const field of ["journal", "legacyJournal"]) {
    const state = stateFor();
    state.habits[0].counts[date] = 1;
    state.habits[0][field] = {
      [date]: {
        baseline: 0,
        entries: [{ delta: 1, kind: "add", time: "08:00", note: "Archived event note" }]
      }
    };
    D.validateState(state);
    const changed = D.setNote(state, "reading", date, "Independent daily note", today);
    assert.deepEqual(changed.habits[0][field], state.habits[0][field]);
    assert.equal(changed.habits[0][field === "journal" ? "legacyJournal" : "journal"], undefined);
    assert.deepEqual(changed.habits[0].counts, state.habits[0].counts);
  }
});

test("daily notes enforce tracked dates and their 500-character storage boundary", () => {
  assert.equal(MAX_NOTE_LENGTH, 500);
  const state = stateFor();
  for (const text of ["x".repeat(500), "🌅".repeat(250)])
    assert.equal(D.setNote(state, "reading", date, text, today).habits[0].notes[date], text);
  for (const text of ["x".repeat(501), "🌅".repeat(251), null, 3, {}])
    assert.throws(() => D.setNote(state, "reading", date, text, today), /500 characters/);
  for (const invalid of ["2026-10-31", "2026-11-13", "2026-02-30", "invalid"])
    assert.throws(() => D.setNote(state, "reading", invalid, "Note", today), /tracked dates/);
  const archived = D.archiveHabit(state, "reading", date);
  assert.throws(() => D.setNote(archived, "reading", today, "Note", today), /tracked dates/);
  assert.throws(() => D.setNote(state, "missing", date, "Note", today), /no longer exists/);
});

test("malformed note imports are rejected without a read-time migration", () => {
  for (const notes of [
    null,
    [],
    "bad",
    { invalid: "Note" },
    { "2026-10-31": "Note" },
    { [date]: "" },
    { [date]: " \n " },
    { [date]: 3 },
    { [date]: "x".repeat(501) }
  ]) {
    const state = stateFor();
    state.habits[0].notes = notes;
    assert.throws(() => D.parseBackup(JSON.stringify(state)), /daily note/);
  }
});

test("task-linked rest days allow notes without manufacturing task completions", () => {
  const linked = D.setTaskSchedule(
    stateFor(),
    "reading",
    {
      repeatId: "series",
      title: "Reading task",
      anchor: date,
      every: 2,
      time: null,
      until: null,
      paused: false
    },
    date
  );
  const result = D.dayResult(linked.habits[0], today, today);
  assert.equal(result.kind, "rest");
  assert.equal(result.readOnly, true);
  const updated = D.setNote(linked, "reading", today, "Rest day observation", today);
  assert.deepEqual(updated.habits[0].counts, linked.habits[0].counts);
  assert.deepEqual(updated.habits[0].taskCompletions, linked.habits[0].taskCompletions);
  assert.deepEqual(D.dayResult(updated.habits[0], today, today), result);
});
