import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import {
  orderedHabits,
  moveHabit,
  createGroup,
  renameGroup,
  removeGroup,
  moveGroup,
  setHabitGroup,
  groupedHabits
} from "../src/organization.js";
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

test("single-level groups preserve histories through moves, rename, reorder, filters and backup reload", () => {
  const state = fixture(),
    original = JSON.stringify(state);
  let next = createGroup(state, "morning", "Morning");
  next = createGroup(next, "study", "Learning");
  next = setHabitGroup(next, "b", "morning");
  next = setHabitGroup(next, "c", "study");
  next = moveHabit(next, "d", "a");
  next = renameGroup(next, "study", "Professional reading");
  next = moveGroup(next, "study", -1);
  assert.deepEqual(
    groupedHabits(next).map((h) => h.id),
    ["c", "b", "d", "a"]
  );
  const archived = D.archiveHabit(next, "c", today);
  const restored = D.parseBackup(D.encodeState(archived));
  assert.equal(restored.habits.find((h) => h.id === "b").hidden, true);
  assert.equal(restored.habits.find((h) => h.id === "c").groupId, "study");
  assert.deepEqual(
    restored.groups.map((g) => g.name),
    ["Professional reading", "Morning"]
  );
  assert.deepEqual(
    groupedHabits(
      restored,
      orderedHabits(restored).filter((h) => D.habitMatchesFilter(h, "active"))
    ).map((h) => h.id),
    ["d", "a"]
  );
  for (const habit of next.habits) {
    const { groupId, ...history } = habit;
    assert.ok(groupId === undefined || ["morning", "study"].includes(groupId));
    assert.deepEqual(
      history,
      state.habits.find((h) => h.id === habit.id)
    );
  }
  assert.equal(JSON.stringify(state), original);
  assert.deepEqual(
    D.statistics(next, today, today, today),
    D.statistics(state, today, today, today)
  );
});

test("removing a nonempty group ungroups active and hidden habits without changing their order or history", () => {
  let state = createGroup(fixture(), "group", "Routine");
  state = setHabitGroup(setHabitGroup(state, "a", "group"), "b", "group");
  const order = ids(state),
    histories = state.habits.map((h) => {
      const copy = { ...h };
      delete copy.groupId;
      return copy;
    });
  const next = removeGroup(state, "group");
  assert.deepEqual(next.groups, []);
  assert.deepEqual(ids(next), order);
  assert.deepEqual(next.habits, histories);
  assert.equal(state.habits[0].groupId, "group");
  assert.equal(Object.hasOwn(setHabitGroup(state, "a", null).habits[0], "groupId"), false);
  D.validateState(next);
});

test("group names preserve user text while malformed memberships and names are rejected", () => {
  const state = fixture();
  const name = "Routine " + String.fromCodePoint(0x1f305);
  const grouped = createGroup(state, "group", name);
  assert.equal(D.parseBackup(D.encodeState(grouped)).groups[0].name, name);
  for (const groups of [
    null,
    {},
    [{ id: "bad id", name: "Name" }],
    [{ id: "g", name: "" }],
    [{ id: "g", name: "x".repeat(81) }],
    [{ id: "g", name: "Line\nBreak" }],
    [
      { id: "g", name: "Name" },
      { id: "g", name: "Other" }
    ],
    [
      { id: "g", name: "Name" },
      { id: "other", name: "Name" }
    ]
  ])
    assert.throws(() => D.validateState({ ...state, groups }));
  assert.throws(() => setHabitGroup(grouped, "a", "missing"), /membership/);
  assert.throws(() => renameGroup(grouped, "missing", "Name"), /no longer exists/);
  assert.throws(() => moveGroup(grouped, "group", -1), /neighboring/);
  const old = D.parseBackup(D.encodeState(state));
  assert.equal(Object.hasOwn(old, "groups"), false);
});

test("failed group saves preserve confirmed membership and names", async () => {
  const state = createGroup(fixture(), "group", "Original");
  const raw = D.encodeState(state);
  for (const transform of [
    (latest) => renameGroup(latest, "group", "Changed"),
    (latest) => setHabitGroup(latest, "a", "group"),
    (latest) => removeGroup(latest, "group")
  ]) {
    const store = createStore({
      loadSyncedData: async () => raw,
      persistDataSynced: async () => {
        throw Error("Save failed");
      }
    });
    await store.reload();
    await assert.rejects(store.mutate(transform), /Save failed/);
    assert.deepEqual(store.snapshot().state, state);
    assert.equal(store.snapshot().blocked, true);
  }
});
