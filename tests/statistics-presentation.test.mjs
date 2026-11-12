import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { assessmentCoverage } from "../src/ui/statistics-view.js";

function fixture() {
  return D.validateState({
    schemaVersion: 1,
    timeZone: "UTC",
    habits: [
      {
        id: "check",
        name: "Check-in",
        startDate: "2026-11-01",
        endDate: null,
        limits: [
          { from: "2026-11-01", value: 1, goal: "at-least", tracking: "check-in", deadline: null }
        ],
        counts: { "2026-11-02": 1, "2026-11-07": 0 }
      },
      {
        id: "quantity",
        name: "Limit",
        startDate: "2026-11-01",
        endDate: null,
        limits: [{ from: "2026-11-01", value: 0 }],
        counts: {}
      }
    ]
  });
}

test("the displayed successful fraction matches the rate while retaining unknown-day coverage", () => {
  const state = fixture(),
    original = JSON.stringify(state);
  const data = D.statistics(state, "2026-11-01", "2026-11-07", "2026-11-07");
  assert.equal(data.rows[0].successRate, 1);
  assert.deepEqual(assessmentCoverage(data.rows[0]), {
    successful: "1 / 1",
    coverage: "1 / 6",
    unmarkedDays: 5
  });
  assert.deepEqual(assessmentCoverage(data.rows[1]), {
    successful: "6 / 6",
    coverage: "6 / 6",
    unmarkedDays: 0
  });
  const total = assessmentCoverage(
    data.total,
    data.rows.reduce((sum, row) => sum + (row.unmarkedDays ?? 0), 0)
  );
  assert.deepEqual(total, { successful: "7 / 7", coverage: "7 / 12", unmarkedDays: 5 });
  assert.equal(data.total.successRate, 1);
  assert.equal(JSON.stringify(state), original);
});

test("unknown-only and today-only periods have no fabricated successful fraction", () => {
  const state = fixture();
  for (const [from, to] of [
    ["2026-11-03", "2026-11-06"],
    ["2026-11-07", "2026-11-07"]
  ]) {
    const row = D.statistics(state, from, to, "2026-11-07").rows[0];
    assert.equal(row.successRate, null);
    assert.equal(assessmentCoverage(row).successful, "—");
    assert.equal(assessmentCoverage(row).coverage, from === to ? "0 / 0" : "0 / 4");
  }
});

test("an explicit missed mark is assessed while an unmarked day is excluded", () => {
  const state = fixture();
  state.habits[0].counts["2026-11-03"] = 0;
  const row = D.statistics(state, "2026-11-01", "2026-11-07", "2026-11-07").rows[0];
  assert.equal(row.successRate, 0.5);
  assert.deepEqual(assessmentCoverage(row), {
    successful: "1 / 2",
    coverage: "2 / 6",
    unmarkedDays: 4
  });
});
