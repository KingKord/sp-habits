import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { createStore } from "../src/store.js";
const today = "2026-11-03";
function fixture() {
  return D.createHabit(
    D.emptyState("Europe/Moscow"),
    { name: "Coffee", unit: "ml", step: 100, limit: 300, initialCount: 0, startDate: "2026-11-01" },
    today,
    "coffee"
  );
}
function withCount(count, zones = { enabled: true, idealMax: 100, yellowMax: 300 }) {
  const state = fixture();
  state.habits[0].counts[today] = count;
  state.habits[0].zones = zones;
  return D.validateState(state).habits[0];
}
test("calendar has custom inclusive ideal/yellow/red boundaries, including zero", () => {
  for (const [count, zone] of [
    [0, "ideal"],
    [100, "ideal"],
    [101, "warning"],
    [300, "warning"],
    [301, "red"]
  ])
    assert.equal(D.calendarResult(withCount(count), today, today).zone, zone);
  assert.equal(
    D.calendarResult(withCount(1, { enabled: true, idealMax: 0, yellowMax: 2 }), today, today).zone,
    "warning"
  );
  assert.equal(
    D.calendarResult(withCount(0, { enabled: true, idealMax: 0, yellowMax: null }), today, today)
      .zone,
    "ideal"
  );
  assert.equal(
    D.calendarResult(withCount(1, { enabled: true, idealMax: 0, yellowMax: null }), today, today)
      .zone,
    "neutral"
  );
});
test("zone and yellow toggles do not change daily-limit success or statistics", () => {
  const state = fixture();
  state.habits[0] = withCount(250, { enabled: false, idealMax: 0, yellowMax: 100 });
  assert.equal(D.calendarResult(state.habits[0], today, today).zone, "neutral");
  assert.equal(D.dayResult(state.habits[0], today, today).kind, "today-good");
  const data = D.statistics(state, "2026-11-01", today, today);
  assert.equal(data.total.successRate, 1);
  assert.equal(data.total.events, 250);
});
test("ideal can follow the historical daily limit as it decreases", () => {
  const state = fixture(),
    h = state.habits[0];
  h.zones = { enabled: true, idealMax: null, yellowMax: null };
  h.limits.push({ from: "2026-11-02", value: 100 });
  h.counts = { "2026-11-01": 200, "2026-11-02": 200 };
  assert.equal(D.calendarResult(h, "2026-11-01", today).zone, "ideal");
  assert.equal(D.calendarResult(h, "2026-11-02", today).zone, "red");
});
test("month calendar aligns Monday, pads weeks, supports leap years and range boundaries", () => {
  const h = fixture().habits[0];
  const november = D.monthCalendar(h, "2026-11", today);
  assert.equal(november.cells.length, 42);
  assert.equal(november.cells[6].date, "2026-11-01");
  assert.equal(november.days.length, 30);
  assert.equal(D.monthCalendar(h, "2024-02", today).days.length, 29);
  assert.equal(D.monthCalendar(h, "2025-02", today).days.length, 28);
  assert.equal(D.monthCalendar(h, "1900-01", today).cells[0].date, "1900-01-01");
  assert.equal(D.monthCalendar(h, "9999-12", today).days.length, 31);
  assert.equal(D.shiftMonth("2026-12", 1), "2027-01");
  assert.equal(D.shiftMonth("2026-01", -1), "2025-12");
  for (const month of ["1899-12", "2026-13", "2026-2"])
    assert.throws(() => D.monthCalendar(h, month, today));
  assert.throws(() => D.shiftMonth("1900-01", -1));
});
test("inactive, future and archived days cannot become calendar successes", () => {
  const h = D.archiveHabit(fixture(), "coffee", today).habits[0];
  assert.equal(D.calendarResult(h, "2026-10-31", today).zone, "inactive");
  assert.equal(D.calendarResult(h, "2026-11-04", today).zone, "future");
  assert.equal(D.calendarResult(h, "2026-11-04", "2026-11-05").zone, "inactive");
  assert.equal(D.calendarResult(h, today, today).kind, "today-good");
});
test("old data stays unchanged on read; invalid zone metadata is rejected", () => {
  const raw = JSON.stringify(fixture());
  assert.equal(JSON.stringify(D.parseState(raw)), raw);
  for (const zones of [
    { enabled: true, idealMax: -1, yellowMax: 1 },
    { enabled: true, idealMax: 100, yellowMax: 99 },
    { enabled: "true", idealMax: null, yellowMax: null }
  ]) {
    const state = fixture();
    state.habits[0].zones = zones;
    assert.throws(() => D.validateState(state));
  }
});
function legacyFixture() {
  const state = fixture();
  state.habits[0].counts[today] = 250;
  state.habits[0].journal = {
    [today]: {
      baseline: 100,
      entries: [{ delta: 150, kind: "add", time: "14:30", note: "after lunch" }]
    }
  };
  return D.validateState(state);
}
test("legacy details remain unchanged on read and are archived once when a total changes", () => {
  const original = legacyFixture(),
    raw = JSON.stringify(original);
  assert.equal(JSON.stringify(D.parseState(raw)), raw);
  const same = D.setCount(original, "coffee", today, 250, today);
  assert.deepEqual(same.habits[0].journal, original.habits[0].journal);
  let state = D.setCount(original, "coffee", today, 200, today);
  assert.equal(JSON.stringify(original), raw);
  assert.equal(state.habits[0].journal, undefined);
  assert.deepEqual(state.habits[0].legacyJournal, original.habits[0].journal);
  state = D.changeCount(state, "coffee", today, 1, today);
  assert.equal(state.habits[0].counts[today], 300);
  assert.deepEqual(state.habits[0].legacyJournal, original.habits[0].journal);
  assert.deepEqual(D.parseState(JSON.stringify(state)), state);
});
test("legacy journal validation still rejects corrupt data and ambiguous archives", () => {
  const state = legacyFixture();
  for (const time of ["24:00", "10:60", "5:00", "", 12]) {
    const broken = structuredClone(state);
    broken.habits[0].journal[today].entries[0].time = time;
    assert.throws(() => D.validateState(broken));
  }
  const broken = structuredClone(state);
  broken.habits[0].counts[today] = 0;
  assert.throws(() => D.validateState(broken));
  const archived = D.setCount(state, "coffee", today, 0, today);
  archived.habits[0].legacyJournal[today].entries[0].note = "x".repeat(501);
  assert.throws(() => D.validateState(archived));
  const ambiguous = structuredClone(state);
  ambiguous.habits[0].legacyJournal = ambiguous.habits[0].journal;
  assert.throws(() => D.validateState(ambiguous));
});
test("new daily totals and quick steps never create a journal", () => {
  let state = D.setCount(fixture(), "coffee", today, 0, today);
  state = D.changeCount(state, "coffee", today, 1, today);
  assert.equal(state.habits[0].counts[today], 100);
  state = D.changeCount(state, "coffee", today, -1, today);
  state = D.applyCountInput(state, "coffee", today, 75, "add", today);
  assert.equal(state.habits[0].counts[today], 75);
  assert.equal(state.habits[0].journal, undefined);
  assert.equal(state.habits[0].legacyJournal, undefined);
});
const plan = { first: "2026-11-10", everyDays: 7, decrease: 100, target: 50 };
test("reduction is calendar-based, hits target exactly and preserves historical counts/limits", () => {
  const original = D.setCount(fixture(), "coffee", today, 200, today),
    raw = JSON.stringify(original);
  const state = D.scheduleReduction(original, "coffee", plan, today),
    h = state.habits[0];
  assert.deepEqual(
    h.limits.map((x) => [x.from, x.value]),
    [
      ["2026-11-01", 300],
      ["2026-11-10", 200],
      ["2026-11-17", 100],
      ["2026-11-24", 50]
    ]
  );
  assert.equal(D.limitForDate(h, "2026-11-09"), 300);
  assert.equal(D.limitForDate(h, "2026-11-10"), 200);
  assert.equal(D.limitForDate(h, "2027-01-01"), 50);
  assert.deepEqual(h.counts, original.habits[0].counts);
  assert.equal(JSON.stringify(original), raw);
});
test("reduction replaces future from its start; cancellation preserves completed stages and manual limits", () => {
  let state = fixture();
  state.habits[0].limits.push({ from: "2026-11-05", value: 250 });
  state = D.scheduleReduction(state, "coffee", plan, today);
  assert.equal(state.habits[0].limits[1].value, 250);
  assert.equal(state.habits[0].limits[2].value, 150);
  state = D.cancelReduction(state, "coffee", "2026-11-11");
  assert.deepEqual(
    state.habits[0].limits.map((x) => [x.from, x.value]),
    [
      ["2026-11-01", 300],
      ["2026-11-05", 250],
      ["2026-11-10", 150]
    ]
  );
});
test("archiving stops future plan and keeps past stages", () => {
  const state = D.scheduleReduction(fixture(), "coffee", plan, today);
  const archived = D.archiveHabit(state, "coffee", "2026-11-11").habits[0];
  assert.equal(archived.endDate, "2026-11-11");
  assert.deepEqual(
    archived.limits.map((x) => x.value),
    [300, 200]
  );
});
test("reduction validates dates, step counts, intervals, targets and archived habits", () => {
  for (const change of [
    { first: today },
    { first: "2026-02-30" },
    { everyDays: 0 },
    { everyDays: 367 },
    { decrease: 0 },
    { target: 300 },
    { target: -1 },
    { decrease: 1, target: 0 }
  ])
    assert.throws(() => D.reductionPreview(fixture().habits[0], { ...plan, ...change }, today));
  assert.throws(() =>
    D.reductionPreview(D.archiveHabit(fixture(), "coffee", today).habits[0], plan, today)
  );
});
test("archived legacy details, custom zones and future plan survive persisted reload", async () => {
  let raw = JSON.stringify(legacyFixture());
  const store = createStore({
    loadSyncedData: async () => raw,
    persistDataSynced: async (value) => {
      raw = value;
    }
  });
  await store.reload();
  await store.mutate((s) => D.applyCountInput(s, "coffee", today, 125, "add", today));
  await store.mutate((s) =>
    D.editHabit(
      s,
      "coffee",
      {
        name: "Coffee",
        limit: 300,
        from: today,
        zones: { enabled: true, idealMax: 0, yellowMax: 200 }
      },
      today
    )
  );
  await store.mutate((s) => D.scheduleReduction(s, "coffee", plan, today));
  await store.reload();
  const h = store.snapshot().state.habits[0];
  assert.equal(h.counts[today], 375);
  assert.equal(h.legacyJournal[today].entries[0].time, "14:30");
  assert.deepEqual(h.zones, { enabled: true, idealMax: 0, yellowMax: 200 });
  assert.equal(D.limitForDate(h, "2026-11-24"), 50);
});

test("coffee goal zero and allowance 300 produce acceptable yellow days, never a failure", () => {
  const state = fixture(),
    habit = state.habits[0];
  habit.zones = { enabled: true, idealMax: 0, yellowMax: null, yellowEnabled: true };
  for (const [count, zone, kind] of [
    [0, "ideal", "success"],
    [1, "warning", "success"],
    [300, "warning", "success"],
    [301, "red", "failure"]
  ]) {
    habit.counts["2026-11-02"] = count;
    const result = D.calendarResult(habit, "2026-11-02", today);
    assert.equal(result.zone, zone);
    assert.equal(result.kind, kind);
    const stats = D.statistics(state, "2026-11-02", "2026-11-02", today).rows[0];
    assert.equal(stats.successRate, count <= 300 ? 1 : 0);
  }
});
test("legacy yellow threshold cannot make an exceeded allowance look acceptable", () => {
  const habit = fixture().habits[0];
  habit.limits[0].value = 100;
  habit.zones = { enabled: true, idealMax: 0, yellowMax: 300 };
  habit.counts[today] = 101;
  assert.equal(D.calendarResult(habit, today, today).zone, "red");
  habit.counts[today] = 100;
  assert.equal(D.calendarResult(habit, today, today).zone, "warning");
  habit.zones.yellowMax = 50;
  assert.equal(D.calendarResult(habit, today, today).zone, "warning");
});
test("a goal is clamped when allowance decreases and yellow toggle never changes acceptance", () => {
  const state = fixture(),
    habit = state.habits[0];
  habit.zones = { enabled: true, idealMax: 200, yellowMax: null, yellowEnabled: true };
  habit.limits.push({ from: today, value: 100 });
  habit.counts[today] = 150;
  assert.equal(D.calendarResult(habit, today, today).idealMax, 100);
  assert.equal(D.calendarResult(habit, today, today).zone, "red");
  habit.zones.idealMax = 0;
  habit.counts[today] = 50;
  habit.zones.yellowEnabled = false;
  assert.equal(D.calendarResult(habit, today, today).zone, "neutral");
  assert.equal(D.dayResult(habit, today, today).kind, "today-good");
  habit.zones.yellowEnabled = true;
  assert.equal(D.calendarResult(habit, today, today).zone, "warning");
  const raw = JSON.stringify(D.validateState(state));
  assert.equal(JSON.stringify(D.parseState(raw)), raw);
  habit.zones.yellowEnabled = "true";
  assert.throws(() => D.validateState(state));
});
