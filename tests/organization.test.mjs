import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { orderedHabits, moveHabit } from "../src/organization.js";
import { createStore } from "../src/store.js";

const today = "2026-11-12";
function fixture() {
  let state = D.emptyState("UTC");
  for (const id of ["a", "b", "c", "d"])
    state = D.createHabit(
      state,
      { name: id, goal: "at-least", limit: 1, startDate: today, initialCount: 1 },
      today,
      id
    );
  return D.setHabitHidden(state, "b", true);
}
const ids = (state) => orderedHabits(state).map((h) => h.id);

test("old backups retain array order without rewriting data and new habits append after manual order", () => {
  const state = fixture(),
    raw = JSON.stringify(state);
  assert.deepEqual(ids(D.parseState(raw)), ["a", "b", "c", "d"]);
  assert.equal(JSON.stringify(state), raw);
  let next = moveHabit(state, "c", "a");
  assert.deepEqual(ids(next), ["c", "b", "a", "d"]);
  assert.deepEqual(next.habits, state.habits);
  next = D.createHabit(
    next,
    { name: "New", limit: 0, startDate: today, initialCount: 0 },
    today,
    "new"
  );
  assert.deepEqual(ids(D.parseBackup(D.encodeState(next))), ["c", "b", "a", "d", "new"]);
});

test("filtered moves preserve invisible positions and hiding, archiving and deletion retain remaining order", () => {
  const state = fixture(),
    next = moveHabit(state, "a", "c");
  assert.deepEqual(ids(next), ["c", "b", "a", "d"]);
  assert.deepEqual(next.habits, state.habits);
  const archived = D.archiveHabit(D.setHabitHidden(next, "b", false), "c", today);
  assert.deepEqual(ids(archived), ["c", "b", "a", "d"]);
  const deleted = D.deleteHabit(archived, "b");
  assert.deepEqual(ids(deleted), ["c", "a", "d"]);
  D.validateState(deleted);
  assert.equal(
    D.statistics(next, today, today, today).total.events,
    D.statistics(state, today, today, today).total.events
  );
});

test("malformed order metadata is rejected instead of silently reassigned", () => {
  for (const habitOrder of [null, {}, ["a", "a"], ["missing"], [5]])
    assert.throws(() => D.validateState({ ...fixture(), habitOrder }), /Invalid habit order/);
  assert.throws(() => moveHabit(fixture(), "a", "missing"));
  assert.throws(() => moveHabit(fixture(), "a", "a"));
});

test("a failed reorder leaves the confirmed order intact and enters the store recovery state", async () => {
  const state = fixture(),
    raw = D.encodeState(state);
  const store = createStore({
    loadSyncedData: async () => raw,
    persistDataSynced: async () => {
      throw Error("Save failed");
    }
  });
  await store.reload();
  await assert.rejects(
    store.mutate((latest) => moveHabit(latest, "a", "c")),
    /Save failed/
  );
  assert.deepEqual(ids(store.snapshot().state), ["a", "b", "c", "d"]);
  assert.equal(store.snapshot().blocked, true);
});
