import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";

test("presets: rolling days and calendar week/month/year stop at today", () => {
  const today = "2026-11-03";
  for (const [preset, from] of [
    ["7d", "2026-10-28"],
    ["week", "2026-11-02"],
    ["30d", "2026-10-05"],
    ["month", "2026-11-01"],
    ["year", "2025-11-04"],
    ["current-year", "2026-01-01"]
  ])
    assert.deepEqual(D.periodRange(preset, today), { from, to: today });
  assert.equal(D.periodRange("week", "2026-11-01").from, "2026-10-26");
  assert.equal(D.periodRange("week", "2026-11-02").from, "2026-11-02");
});
test("calendar rolling year handles leap days and the supported lower date boundary", () => {
  assert.equal(D.periodRange("year", "2024-02-29").from, "2023-03-01");
  assert.equal(D.periodRange("year", "2025-02-28").from, "2024-02-29");
  assert.equal(D.periodRange("7d", "1900-01-01").from, "1900-01-01");
  assert.equal(D.periodRange("year", "1900-11-03").from, "1900-01-01");
  assert.throws(() => D.periodRange("nonsense", "2026-11-03"));
});

function fixture() {
  return D.validateState({
    schemaVersion: 1,
    timeZone: "Europe/Moscow",
    habits: [
      {
        id: "coffee",
        name: "Coffee",
        startDate: "2026-10-30",
        endDate: null,
        limits: [
          { from: "2026-10-30", value: 0 },
          { from: "2026-11-01", value: 1 }
        ],
        counts: { "2026-10-31": 1, "2026-11-01": 1, "2026-11-02": 2, "2026-11-03": 4 }
      },
      {
        id: "archived",
        name: "Sweets",
        startDate: "2026-11-01",
        endDate: "2026-11-02",
        limits: [{ from: "2026-11-01", value: 2 }],
        counts: { "2026-11-01": 2, "2026-11-02": 3 }
      }
    ]
  });
}
test("stats respect historical limits, missing zeroes and provisional today", () => {
  const state = fixture(),
    original = JSON.stringify(state);
  const result = D.statistics(state, "2026-10-29", "2026-11-03", "2026-11-03", "active").rows[0];
  assert.equal(result.events, 8);
  assert.equal(result.trackedDays, 5);
  assert.equal(result.completedDays, 4);
  assert.equal(result.successDays, 2);
  assert.equal(result.exceededDays, 2);
  assert.equal(result.successRate, 0.5);
  assert.equal(result.average, 1.6);
  assert.deepEqual(result.today, { count: 4, limit: 1, within: false });
  assert.equal(JSON.stringify(state), original, "statistics must not write calculated results");
});
test("archived history is clipped; summary weights habit-days rather than averaging rates", () => {
  const result = D.statistics(fixture(), "2026-10-29", "2026-11-03", "2026-11-03");
  assert.equal(result.rows[1].from, "2026-11-01");
  assert.equal(result.rows[1].to, "2026-11-02");
  assert.equal(result.rows[1].events, 5);
  assert.equal(result.rows[1].successDays, 1);
  assert.equal(result.total.events, 13);
  assert.equal(result.total.completedDays, 6);
  assert.equal(result.total.successDays, 3);
  assert.equal(result.total.successRate, 0.5);
  const archived = D.statistics(fixture(), "2026-10-29", "2026-11-03", "2026-11-03", "archived");
  assert.deepEqual(
    archived.rows.map((r) => r.id),
    ["archived"]
  );
});
test("period with no tracking has null totals, not a fabricated zero or success", () => {
  const result = D.statistics(fixture(), "2026-10-01", "2026-10-02", "2026-11-03");
  assert.equal(result.rows[0].events, null);
  assert.equal(result.rows[0].average, null);
  assert.equal(result.rows[0].successRate, null);
  assert.equal(result.total.events, null);
  assert.equal(result.total.successRate, null);
  assert.equal(result.total.trackedDays, 0);
});
test("today-only includes events but has no final success/failure rate", () => {
  const result = D.statistics(fixture(), "2026-11-03", "2026-11-03", "2026-11-03", "active");
  assert.equal(result.total.events, 4);
  assert.equal(result.total.completedDays, 0);
  assert.equal(result.total.exceededDays, 0);
  assert.equal(result.total.successRate, null);
  assert.equal(result.rows[0].today.within, false);
});
test("custom periods validate endpoints and exclude events outside their inclusive range", () => {
  const state = fixture();
  for (const [from, to] of [
    ["2026-11-03", "2026-11-02"],
    ["2026-11-01", "2026-11-04"],
    ["2026-02-30", "2026-11-03"]
  ])
    assert.throws(() => D.statistics(state, from, to, "2026-11-03"));
  const result = D.statistics(state, "2026-11-01", "2026-11-01", "2026-11-03");
  assert.equal(result.total.events, 3);
  assert.equal(result.total.successDays, 2);
  assert.equal(result.total.successRate, 1);
  assert.equal(
    D.statistics(D.emptyState(), "2026-11-01", "2026-11-03", "2026-11-03").rows.length,
    0
  );
});
test("long custom periods use arithmetic day counts and sparse recorded events", () => {
  const state = D.validateState({
    schemaVersion: 1,
    timeZone: "UTC",
    habits: [
      {
        id: "long",
        name: "Long history",
        startDate: "1900-01-01",
        endDate: null,
        limits: [{ from: "1900-01-01", value: 0 }],
        counts: { "2026-11-01": 1 }
      }
    ]
  });
  const result = D.statistics(state, "1900-01-01", "9999-12-31", "9999-12-31").rows[0];
  assert.equal(result.events, 1);
  assert.equal(result.exceededDays, 1);
  assert.ok(result.completedDays > 2900000);
  assert.equal(result.successDays, result.completedDays - 1);
});
