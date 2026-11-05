import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { createStore } from "../src/store.js";

const today = "2026-11-02";
function sample(limit = 0) {
  return D.createHabit(
    D.emptyState("Europe/Moscow"),
    { name: "Coffee", limit, initialCount: 0, startDate: "2026-10-30" },
    today,
    "coffee"
  );
}
test("zero limit, missing event and boundary equality", () => {
  let state = sample();
  assert.equal(D.dayResult(state.habits[0], "2026-11-01", today).kind, "success");
  state = D.setCount(state, "coffee", "2026-11-01", 1, today);
  assert.equal(D.dayResult(state.habits[0], "2026-11-01", today).kind, "failure");
  state = sample(2);
  state = D.setCount(state, "coffee", "2026-11-01", 2, today);
  assert.equal(D.dayResult(state.habits[0], "2026-11-01", today).kind, "success");
  state = D.changeCount(state, "coffee", "2026-11-01", 1, today);
  assert.equal(D.dayResult(state.habits[0], "2026-11-01", today).kind, "failure");
});
test("today is provisional; dates outside tracking have no checkmark", () => {
  const habit = sample().habits[0];
  assert.equal(D.dayResult(habit, today, today).kind, "today-good");
  habit.counts[today] = 1;
  assert.equal(D.dayResult(habit, today, today).kind, "today-bad");
  assert.equal(D.dayResult(habit, "2026-10-29", today).kind, "inactive");
  assert.equal(D.dayResult(habit, "2026-11-03", today).kind, "future");
  assert.throws(() => D.setCount(sample(), "coffee", "2026-10-29", 1, today));
  assert.throws(() => D.setCount(sample(), "coffee", "2026-11-03", 1, today));
});
test("decrement floors at zero; immutable writes and upper guard", () => {
  const original = sample();
  const next = D.changeCount(original, "coffee", today, -1, today);
  assert.equal(next.habits[0].counts[today], 0);
  assert.deepEqual(original.habits[0].counts, {});
  assert.throws(() => D.setCount(original, "coffee", today, -1, today));
  assert.throws(() => D.setCount(original, "coffee", today, 0.5, today));
  assert.throws(() => D.setCount(original, "coffee", today, D.MAX_VALUE + 1, today));
});
test("date boundaries use configured timezone, including DST and year transition", () => {
  assert.equal(D.todayInZone("Europe/Moscow", new Date("2026-11-01T21:00:00Z")), today);
  assert.equal(
    D.todayInZone("America/Los_Angeles", new Date("2026-11-02T01:00:00Z")),
    "2026-11-01"
  );
  assert.equal(D.addDays("2026-03-08", 1), "2026-03-09");
  assert.equal(D.addDays("2025-12-31", 1), "2026-01-01");
  assert.equal(D.addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(D.validDate("2026-02-29"), false);
  assert.equal(D.validDate("2026-04-31"), false);
});
test("limits are versioned and renaming preserves history", () => {
  let state = sample();
  state = D.editHabit(state, "coffee", { name: "Any name", limit: 2, from: today }, today);
  assert.equal(D.limitForDate(state.habits[0], "2026-11-01"), 0);
  assert.equal(D.limitForDate(state.habits[0], today), 2);
  state = D.editHabit(state, "coffee", { name: "Renamed", limit: 1, from: "2026-11-01" }, today);
  assert.deepEqual(
    state.habits[0].limits.map((x) => x.value),
    [0, 1, 2]
  );
  assert.equal(D.limitForDate(state.habits[0], today), 2);
});
test("archive keeps tracked final day and has no successes afterward", () => {
  const state = D.archiveHabit(sample(), "coffee", today);
  assert.equal(D.dayResult(state.habits[0], today, "2026-11-05").kind, "success");
  assert.equal(D.dayResult(state.habits[0], "2026-11-03", "2026-11-05").kind, "inactive");
  assert.throws(() => D.setCount(state, "coffee", "2026-11-03", 1, "2026-11-05"));
});
test("import validates schema, IDs, limits, count dates and timezone", () => {
  assert.deepEqual(D.parseState(JSON.stringify(sample())), sample());
  for (const alter of [
    (s) => {
      s.schemaVersion = 2;
    },
    (s) => {
      s.timeZone = "Invalid/Place";
    },
    (s) => {
      s.habits.push(s.habits[0]);
    },
    (s) => {
      s.habits[0].limits[0].from = today;
    },
    (s) => {
      s.habits[0].counts["2026-02-30"] = 0;
    },
    (s) => {
      s.habits[0].counts[{}] = 0;
      Object.defineProperty(s.habits[0].counts, {}, { value: 1, enumerable: true });
    },
    (s) => {
      s.habits[0].counts[today] = "1";
    },
    (s) => {
      s.habits[0].name = " ";
    }
  ]) {
    const state = sample();
    alter(state);
    assert.throws(() => D.validateState(state));
  }
  assert.throws(() => D.parseState(""));
  assert.throws(() => D.parseState("{"));
});
test("several unopened days are computed without writing fake events", () => {
  const state = sample();
  assert.equal(D.dayResult(state.habits[0], "2026-11-05", "2026-11-06").kind, "success");
  assert.deepEqual(state.habits[0].counts, {});
});
test("new habit rejects future date; names are kept as text", () => {
  assert.throws(() =>
    D.createHabit(
      D.emptyState(),
      { name: "x", limit: 0, initialCount: 0, startDate: "2026-11-03" },
      today,
      "x"
    )
  );
  const state = D.createHabit(
    D.emptyState(),
    { name: "<img onerror=alert(1)>", limit: 0, initialCount: 2, startDate: today },
    today,
    "x"
  );
  assert.equal(state.habits[0].counts[today], 2);
});

function mock(initial = JSON.stringify(sample())) {
  let raw = initial,
    writes = 0;
  const api = {
    loadSyncedData: async () => raw,
    persistDataSynced: async (value) => {
      writes++;
      await new Promise((r) => setTimeout(r, 2));
      raw = value;
    }
  };
  return {
    api,
    get raw() {
      return raw;
    },
    get writes() {
      return writes;
    },
    set raw(value) {
      raw = value;
    }
  };
}
test("serialized rapid clicks survive reload, without lost increments", async () => {
  const m = mock(),
    store = createStore(m.api);
  await store.reload();
  await Promise.all(
    Array.from({ length: 25 }, () =>
      store.mutate((s) => D.changeCount(s, "coffee", today, 1, today))
    )
  );
  assert.equal(store.snapshot().pending, 0);
  assert.equal(D.parseState(m.raw).habits[0].counts[today], 25);
  const reopened = createStore(m.api);
  await reopened.reload();
  assert.equal(reopened.snapshot().state.habits[0].counts[today], 25);
});
test("failed writes stop queued mutations; reread resolves ambiguous acknowledgement", async () => {
  const m = mock();
  m.api.persistDataSynced = async (value) => {
    m.raw = value;
    throw new Error("Timeout");
  };
  const store = createStore(m.api);
  await store.reload();
  const results = await Promise.allSettled(
    Array.from({ length: 3 }, () =>
      store.mutate((s) => D.changeCount(s, "coffee", today, 1, today))
    )
  );
  assert.equal(
    results.every((r) => r.status === "rejected"),
    true
  );
  assert.equal(store.snapshot().state.habits[0].counts[today], undefined);
  assert.equal(store.snapshot().blocked, true);
  assert.equal(D.parseState(m.raw).habits[0].counts[today], 1);
  await store.reload();
  assert.equal(store.snapshot().state.habits[0].counts[today], 1);
});
test("invalid storage and read failures never replace history with empty data", async () => {
  const m = mock('{"schemaVersion":99}');
  const store = createStore(m.api);
  assert.equal(await store.reload(), false);
  assert.equal(store.snapshot().state, null);
  assert.equal(store.snapshot().raw, '{"schemaVersion":99}');
  await assert.rejects(store.mutate((s) => s));
  assert.equal(m.writes, 0);
  m.raw = JSON.stringify(sample());
  assert.equal(await store.reload(), true);
  m.api.loadSyncedData = async () => {
    throw new Error("Read failed");
  };
  assert.equal(await store.reload(), false);
  assert.equal(store.snapshot().state.habits.length, 1);
});
test("null storage is initialized in memory only; external sequential updates are reread", async () => {
  const m = mock(null),
    store = createStore(m.api);
  await store.reload();
  assert.deepEqual(store.snapshot().state.habits, []);
  assert.equal(m.writes, 0);
  m.raw = JSON.stringify(sample());
  await store.mutate((s) => D.changeCount(s, "coffee", today, 1, today));
  assert.equal(store.snapshot().state.habits[0].counts[today], 1);
});
test("missing host API is a visible load failure", async () => {
  const store = createStore(undefined);
  assert.equal(await store.reload(), false);
  assert.match(store.snapshot().error, /Super Productivity/);
});

test("backdating tracking preserves counts and all later limit boundaries", () => {
  const original = D.setCount(sample(1), "coffee", today, 1, today);
  const changed = D.editHabit(
    original,
    "coffee",
    { name: "Coffee", limit: 0, from: "2026-10-29" },
    today
  );
  const habit = changed.habits[0];
  assert.equal(habit.startDate, "2026-10-29");
  assert.deepEqual(habit.limits, [
    { from: "2026-10-29", value: 0 },
    { from: "2026-10-30", value: 1 }
  ]);
  assert.deepEqual(habit.counts, original.habits[0].counts);
  assert.equal(D.dayResult(habit, "2026-10-29", today).kind, "success");
  assert.equal(D.dayResult(habit, "2026-10-28", today).kind, "inactive");
  assert.equal(D.limitForDate(habit, today), 1);
  assert.equal(original.habits[0].startDate, "2026-10-30");
});
test("backdating with equal limit still establishes a valid tracking boundary", () => {
  const state = D.editHabit(
    sample(0),
    "coffee",
    { name: "Coffee", limit: 0, from: "2026-10-29" },
    today
  );
  assert.equal(D.parseState(JSON.stringify(state)).habits[0].limits[0].from, "2026-10-29");
  const archived = D.archiveHabit(state, "coffee", today);
  const edited = D.editHabit(
    archived,
    "coffee",
    { name: "Coffee", limit: 2, from: "2026-10-28" },
    today
  );
  assert.equal(edited.habits[0].endDate, today);
  assert.equal(D.dayResult(edited.habits[0], "2026-10-28", today).limit, 2);
});
test("backdating rejects invalid dates and edits past today or archive", () => {
  for (const from of ["2026-02-30", "1899-12-31", "2026-11-03"]) {
    assert.throws(() => D.editHabit(sample(), "coffee", { name: "Coffee", limit: 0, from }, today));
  }
  const archived = D.archiveHabit(sample(), "coffee", today);
  assert.throws(() =>
    D.editHabit(archived, "coffee", { name: "Coffee", limit: 0, from: "2026-11-03" }, "2026-11-04")
  );
});
