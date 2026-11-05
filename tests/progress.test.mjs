import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { recordText } from "../src/ui/progress-view.js";
import { setLanguage } from "../src/i18n/index.js";
import messages from "../src/i18n/ru.json" with { type: "json" };

const today = "2026-10-29";
function fixture(current = 12) {
  return {
    id: "reading",
    name: "Reading",
    startDate: "2026-10-01",
    endDate: null,
    limits: [{ from: "2026-10-01", goal: "at-least", value: 1 }],
    zones: { enabled: true, yellowEnabled: true, idealMax: 2, yellowMax: null },
    counts: Object.fromEntries([
      ...Array.from({ length: 15 }, (_, i) => [D.addDays("2026-10-01", i), 1]),
      ...Array.from({ length: current }, (_, i) => [D.addDays("2026-10-17", i), i < 3 ? 2 : 1])
    ])
  };
}
function oracle(h, date, now) {
  let days = 0,
    idealDays = 0,
    bestDays = 0,
    previousBest = 0,
    kind = "empty";
  for (
    let d = h.startDate;
    d <= date && d < now && (!h.endDate || d <= h.endDate);
    d = D.addDays(d, 1)
  ) {
    const r = D.calendarResult(h, d, now);
    if (r.kind === "rest") continue;
    if (r.kind === "failure") {
      previousBest = Math.max(previousBest, days);
      days = idealDays = 0;
      kind = "broken";
    } else {
      days++;
      kind = "active";
      if (r.zone === "ideal") idealDays++;
      bestDays = Math.max(bestDays, days);
    }
  }
  return { days, idealDays, kind, bestDays, isRecord: previousBest > 0 && days > previousBest };
}

test("the selected design shows 12 current days, 3 ideal days, best 15, next goal 14 and earned 7/14 badges", () => {
  const h = fixture(),
    raw = JSON.stringify(h);
  assert.deepEqual(D.habitProgress(h, today, today), {
    days: 12,
    idealDays: 3,
    kind: "active",
    bestDays: 15,
    isRecord: false,
    nextGoal: 14,
    remaining: 2,
    achievements: [
      { days: 7, earned: true },
      { days: 14, earned: true },
      { days: 30, earned: false }
    ]
  });
  assert.equal(JSON.stringify(h), raw);
  assert.deepEqual(
    D.habitProgress(
      D.parseState(JSON.stringify({ schemaVersion: 1, timeZone: "UTC", habits: [h] })).habits[0],
      today,
      today
    ),
    D.habitProgress(h, today, today)
  );
});

test("a missed day resets only current counts; best and earned badges survive a new run", () => {
  const h = fixture();
  h.counts["2026-10-28"] = 0;
  const broken = D.habitProgress(h, today, today);
  assert.equal(broken.days, 0);
  assert.equal(broken.idealDays, 0);
  assert.equal(broken.bestDays, 15);
  assert.equal(broken.nextGoal, 7);
  assert.deepEqual(
    broken.achievements.map((a) => a.earned),
    [true, true, false]
  );
  h.counts[today] = 2;
  const restarted = D.habitProgress(h, "2026-10-30", "2026-10-30");
  assert.equal(restarted.days, 1);
  assert.equal(restarted.idealDays, 1);
  assert.equal(restarted.bestDays, 15);
  assert.equal(restarted.remaining, 6);
  assert.deepEqual(restarted.achievements, broken.achievements);
});

test("goals advance exactly at milestones, then in thirty-day steps; there is no completed or zero-length target", () => {
  for (const [days, target] of [
    [0, 7],
    [1, 7],
    [6, 7],
    [7, 14],
    [13, 14],
    [14, 30],
    [29, 30],
    [30, 60],
    [59, 60],
    [60, 90]
  ]) {
    const h = {
      ...fixture(),
      startDate: "2026-01-01",
      limits: [{ from: "2026-01-01", value: 0 }],
      counts: {},
      zones: undefined
    };
    const now = D.addDays(h.startDate, days);
    const p = D.habitProgress(h, now, now);
    assert.equal(p.days, days);
    assert.equal(p.bestDays, days);
    assert.equal(p.nextGoal, target);
    assert.equal(p.remaining, target - days);
    assert.ok(p.remaining > 0);
    assert.deepEqual(
      p.achievements.map((a) => a.earned),
      [days >= 7, days >= 14, days >= 30]
    );
  }
});

test("a new-record label requires exceeding an earlier run, not tying it or counting today", () => {
  const tie = fixture(15);
  assert.equal(D.habitProgress(tie, "2026-11-01", "2026-11-01").isRecord, false);
  const h = fixture(16);
  assert.equal(D.habitProgress(h, "2026-11-01", "2026-11-01").bestDays, 15);
  const p = D.habitProgress(h, "2026-11-02", "2026-11-02");
  assert.equal(p.days, 16);
  assert.equal(p.bestDays, 16);
  assert.equal(p.isRecord, true);
  assert.equal(p.nextGoal, 30);
  assert.equal(p.remaining, 14);
});

test("past dates and archives never receive future records or badges; history corrections recalculate honestly", () => {
  const h = fixture();
  assert.equal(D.habitProgress(h, "2026-10-06", today).bestDays, 6);
  assert.deepEqual(
    D.habitProgress(h, "2026-10-06", today).achievements.map((a) => a.earned),
    [false, false, false]
  );
  h.endDate = "2026-10-07";
  const archived = D.habitProgress(h, today, today);
  assert.equal(archived.bestDays, 7);
  assert.equal(archived.days, 7);
  h.endDate = null;
  h.counts["2026-10-08"] = 0;
  const corrected = D.habitProgress(h, today, today);
  assert.equal(corrected.days, 12);
  assert.equal(corrected.bestDays, 12);
  assert.equal(corrected.isRecord, true);
  assert.deepEqual(
    corrected.achievements.map((a) => a.earned),
    [true, false, false]
  );
  h.hidden = true;
  assert.deepEqual(D.habitProgress(h, today, today), corrected);
});

test("record spans match an independent daily walk across changing goals, periods, schedules and task completions", () => {
  for (let seed = 0; seed < 24; seed++) {
    const h = {
      ...fixture(),
      counts: Object.fromEntries(
        Array.from({ length: 35 }, (_, i) => [D.addDays("2026-10-01", i), (i * 13 + seed * 7) % 5])
      ),
      limits: [
        { from: "2026-10-01", value: seed % 3, periodDays: (seed % 5) + 1 },
        { from: "2026-10-12", value: seed % 4, periodDays: (seed % 7) + 1, goal: "at-least" }
      ],
      zones: {
        enabled: seed % 3 !== 0,
        yellowEnabled: seed % 2 === 0,
        idealMax: 2,
        yellowMax: null
      },
      taskSchedules: [
        {
          from: "2026-10-05",
          repeatId: "series",
          anchor: "2026-10-04",
          every: (seed % 4) + 1,
          paused: false,
          until: "2026-10-25"
        },
        { from: "2026-10-20", repeatId: null }
      ],
      taskCompletions: { a: { repeatId: "series", date: "2026-10-07" } }
    };
    for (let i = 0; i < 35; i++) {
      const date = D.addDays(h.startDate, i),
        p = D.habitProgress(h, date, "2026-11-05");
      const { nextGoal, remaining, achievements, ...metrics } = p;
      assert.deepEqual(metrics, oracle(h, date, "2026-11-05"), `seed ${seed}, ${date}`);
      assert.ok(nextGoal > p.days);
      assert.equal(remaining, nextGoal - p.days);
      assert.deepEqual(
        achievements.map((a) => a.earned),
        [p.bestDays >= 7, p.bestDays >= 14, p.bestDays >= 30]
      );
    }
  }
});

test("huge sparse histories and both date boundaries yield finite records and goals without daily scanning", () => {
  const h = {
    ...fixture(),
    startDate: "1900-01-01",
    limits: [{ from: "1900-01-01", value: 0, periodDays: 366 }],
    counts: { "2026-11-01": 1 },
    zones: undefined
  };
  const empty = D.habitProgress(h, "1900-01-01", "1900-01-01");
  assert.equal(empty.kind, "empty");
  assert.equal(empty.bestDays, 0);
  assert.equal(empty.nextGoal, 7);
  const p = D.habitProgress(h, "9999-12-31", "9999-12-31");
  assert.ok(p.bestDays > 2900000);
  assert.equal(p.days, p.bestDays);
  assert.ok(p.nextGoal > p.days);
  assert.ok(Number.isFinite(p.remaining));
  assert.deepEqual(
    p.achievements.map((a) => a.earned),
    [true, true, true]
  );
});

test("record labels localize an empty record, a saved best and a new best", () => {
  setLanguage("ru", messages);
  try {
    assert.equal(
      recordText({ kind: "empty", isRecord: false, bestDays: 0 }),
      messages["Best: "] + "—"
    );
    assert.equal(
      recordText({ kind: "active", isRecord: false, bestDays: 15 }),
      messages["Best: "] + "15"
    );
  } finally {
    setLanguage("en");
  }
  assert.equal(recordText({ kind: "active", isRecord: true, bestDays: 16 }), "New best: 16");
});
