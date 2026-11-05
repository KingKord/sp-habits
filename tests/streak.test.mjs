import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { streakLabels } from "../src/ui/format.js";
import { setLanguage } from "../src/i18n/index.js";
import messages from "../src/i18n/ru.json" with { type: "json" };

const today = "2026-11-04";
function habit(overrides = {}) {
  return {
    id: "reading",
    name: "Reading",
    startDate: "2026-10-22",
    endDate: null,
    limits: [{ from: "2026-10-22", value: 20, goal: "at-least" }],
    zones: { enabled: true, yellowEnabled: true, idealMax: 30, yellowMax: null },
    counts: Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [
        D.addDays("2026-10-23", i),
        [1, 9, 11].includes(i) ? 30 : 20
      ])
    ),
    ...overrides
  };
}
function oracle(h, date, now) {
  const result = { days: 0, idealDays: 0, kind: "empty" };
  for (
    let d = h.startDate;
    d <= date && d < now && (!h.endDate || d <= h.endDate);
    d = D.addDays(d, 1)
  ) {
    const day = D.calendarResult(h, d, now);
    if (day.kind === "rest") continue;
    if (day.kind === "failure") {
      result.days = result.idealDays = 0;
      result.kind = "broken";
    } else {
      result.days++;
      result.kind = "active";
      if (day.zone === "ideal") result.idealDays++;
    }
  }
  return result;
}

test("twelve successful days contain only three ideal days, even when they are separated by yellow", () => {
  const h = habit(),
    raw = JSON.stringify(h);
  assert.deepEqual(D.habitStreak(h, today, today), { days: 12, idealDays: 3, kind: "active" });
  assert.equal(JSON.stringify(h), raw);
  assert.deepEqual(D.habitStreak(JSON.parse(raw), today, today), D.habitStreak(h, today, today));
});

test("a yellow final day preserves the streak; a red final day resets both counters", () => {
  const h = habit();
  h.counts["2026-11-03"] = 20;
  assert.deepEqual(D.habitStreak(h, today, today), { days: 12, idealDays: 2, kind: "active" });
  h.counts["2026-11-03"] = 19;
  assert.deepEqual(D.habitStreak(h, today, today), { days: 0, idealDays: 0, kind: "broken" });
  h.counts[today] = 30;
  assert.deepEqual(D.habitStreak(h, "2026-11-05", "2026-11-05"), {
    days: 1,
    idealDays: 1,
    kind: "active"
  });
});

test("today is provisional for success, failure and ideal counts until the next local day", () => {
  const h = habit();
  for (const count of [0, 20, 30]) {
    h.counts[today] = count;
    assert.deepEqual(D.habitStreak(h, today, today), { days: 12, idealDays: 3, kind: "active" });
  }
  assert.deepEqual(D.habitStreak(h, "2026-11-05", "2026-11-05"), {
    days: 13,
    idealDays: 4,
    kind: "active"
  });
});

test("past corrections, selected dates, missing positive records and archives bound the current series", () => {
  const h = habit();
  assert.deepEqual(D.habitStreak(h, "2026-10-24", today), {
    days: 2,
    idealDays: 1,
    kind: "active"
  });
  assert.deepEqual(D.habitStreak(h, "2026-10-21", today), { days: 0, idealDays: 0, kind: "empty" });
  delete h.counts["2026-11-01"];
  assert.deepEqual(D.habitStreak(h, today, today), { days: 2, idealDays: 1, kind: "active" });
  h.counts["2026-11-01"] = 30;
  assert.deepEqual(D.habitStreak(h, today, today), { days: 12, idealDays: 3, kind: "active" });
  h.endDate = "2026-11-02";
  assert.deepEqual(D.habitStreak(h, today, today), { days: 11, idealDays: 2, kind: "active" });
});

test("maximum goals count zero records, equality and ideal thresholds without requiring daily events", () => {
  const h = habit({
    startDate: "2026-11-01",
    limits: [{ from: "2026-11-01", value: 2 }],
    zones: { enabled: true, yellowEnabled: true, idealMax: 1, yellowMax: 2 },
    counts: { "2026-11-02": 2, "2026-11-03": 1 }
  });
  assert.deepEqual(D.habitStreak(h, today, today), { days: 3, idealDays: 2, kind: "active" });
  h.counts["2026-11-02"] = 3;
  assert.deepEqual(D.habitStreak(h, today, today), { days: 1, idealDays: 1, kind: "active" });
});

test("colour switches do not change success and neutral days do not become ideal", () => {
  const h = habit();
  h.zones.yellowEnabled = false;
  assert.deepEqual(D.habitStreak(h, today, today), { days: 12, idealDays: 3, kind: "active" });
  h.zones.enabled = false;
  assert.deepEqual(D.habitStreak(h, today, today), { days: 12, idealDays: 0, kind: "active" });
  h.counts["2026-11-03"] = 0;
  assert.equal(D.habitStreak(h, today, today).kind, "broken");
});

test("scheduled rest days and pauses preserve but never inflate a series; task completions count", () => {
  const h = habit({
    startDate: "2026-11-01",
    limits: [{ from: "2026-11-01", value: 1, goal: "at-least" }],
    zones: undefined,
    counts: {},
    taskSchedules: [
      {
        from: "2026-11-01",
        repeatId: "series",
        anchor: "2026-11-01",
        every: 2,
        paused: false,
        until: null
      }
    ],
    taskCompletions: {
      a: { repeatId: "series", date: "2026-11-01" },
      b: { repeatId: "series", date: "2026-11-03" },
      c: { repeatId: "series", date: "2026-11-07" }
    }
  });
  assert.deepEqual(D.habitStreak(h, "2026-11-04", "2026-11-08"), {
    days: 2,
    idealDays: 2,
    kind: "active"
  });
  assert.deepEqual(D.habitStreak(h, "2026-11-06", "2026-11-08"), {
    days: 0,
    idealDays: 0,
    kind: "broken"
  });
  assert.deepEqual(D.habitStreak(h, "2026-11-08", "2026-11-08"), {
    days: 1,
    idealDays: 1,
    kind: "active"
  });
  delete h.taskCompletions.c;
  h.taskSchedules.push({ ...h.taskSchedules[0], from: "2026-11-05", paused: true });
  assert.deepEqual(D.habitStreak(h, "2026-11-08", "2026-11-08"), {
    days: 2,
    idealDays: 2,
    kind: "active"
  });
  h.taskSchedules[1] = { ...h.taskSchedules[0], from: "2026-11-05", until: "2026-11-04" };
  assert.deepEqual(D.habitStreak(h, "2026-11-08", "2026-11-08"), {
    days: 2,
    idealDays: 2,
    kind: "active"
  });
});

test("span calculation matches daily assessments across changing goals, windows, schedules and task data", () => {
  for (let seed = 0; seed < 32; seed++) {
    const h = habit({
      startDate: "2026-10-01",
      limits: [
        { from: "2026-10-01", value: seed % 3, periodDays: (seed % 7) + 1 },
        { from: "2026-10-12", value: seed % 4, periodDays: (seed % 5) + 1, goal: "at-least" },
        {
          from: "2026-10-24",
          value: seed % 4,
          periodDays: (seed % 3) + 1,
          goal: seed % 2 ? "at-least" : "at-most"
        }
      ],
      zones: {
        enabled: seed % 5 !== 0,
        yellowEnabled: seed % 3 !== 0,
        idealMax: seed % 4,
        yellowMax: null
      },
      counts: Object.fromEntries(
        Array.from({ length: 35 }, (_, i) => [D.addDays("2026-10-01", i), (i * 13 + seed * 3) % 5])
      ),
      taskSchedules: [
        {
          from: "2026-10-05",
          repeatId: "series",
          anchor: "2026-10-04",
          every: (seed % 4) + 1,
          paused: false,
          until: "2026-10-25"
        },
        { from: "2026-10-18", repeatId: null },
        {
          from: "2026-10-30",
          repeatId: "series",
          anchor: "2026-10-30",
          every: 2,
          paused: seed % 2 === 0,
          until: null
        }
      ],
      taskCompletions: {
        a: { repeatId: "series", date: "2026-10-07" },
        b: { repeatId: "series", date: "2026-10-31" }
      }
    });
    for (let day = 0; day < 35; day++) {
      const date = D.addDays(h.startDate, day);
      assert.deepEqual(
        D.habitStreak(h, date, today),
        oracle(h, date, today),
        `seed ${seed}, ${date}`
      );
    }
  }
});

test("long sparse histories and supported date boundaries use arithmetic, not millions of daily scans", () => {
  const h = habit({
    startDate: "1900-01-01",
    limits: [{ from: "1900-01-01", value: 0, periodDays: 366 }],
    zones: undefined,
    counts: { "2026-11-01": 1 }
  });
  assert.deepEqual(D.habitStreak(h, "1900-01-01", "1900-01-01"), {
    days: 0,
    idealDays: 0,
    kind: "empty"
  });
  const lastFailure = D.addDays("2026-11-01", 365);
  const days = (Date.parse("9999-12-30") - Date.parse(lastFailure)) / 86400000;
  assert.deepEqual(D.habitStreak(h, "9999-12-31", "9999-12-31"), {
    days,
    idealDays: days,
    kind: "active"
  });
  assert.throws(() => D.habitStreak(h, "invalid", today));
  assert.throws(() => D.habitStreak(h, today, "2026-02-30"));
});

test("streak labels use catalog plural forms and English fallback without changing numbers", () => {
  setLanguage("ru", messages);
  try {
    for (const [days, category] of [
      [1, "one"],
      [2, "few"],
      [5, "many"],
      [11, "many"],
      [21, "one"],
      [22, "few"]
    ])
      assert.equal(
        streakLabels({ days, idealDays: 0, kind: "active" }).days,
        days + " " + messages["days in a row"][category]
      );
    assert.equal(
      streakLabels({ days: 0, idealDays: 0, kind: "empty" }).days,
      messages["No completed days"]
    );
    assert.equal(
      streakLabels({ days: 0, idealDays: 0, kind: "broken" }).days,
      messages["0 · streak ended"]
    );
  } finally {
    setLanguage("en");
  }
  assert.deepEqual(streakLabels({ days: 12, idealDays: 3, kind: "active" }), {
    days: "12 days in a row",
    ideal: "Ideal days in streak: 3"
  });
  assert.equal(streakLabels({ days: 1, idealDays: 1, kind: "active" }).days, "1 day in a row");
});
