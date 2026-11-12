import test from "node:test";
import assert from "node:assert/strict";
import { fieldsHarness } from "./fixtures/ui-fields.mjs";
import { createScheduleFields } from "../src/ui/schedule-fields.js";
import { createPauseFields } from "../src/ui/pause-fields.js";
import { createWeeklyFields } from "../src/ui/weekly-fields.js";

test("schedule controls switch modes, validate an empty weekday set and retain interval drafts", () => {
  const h = fieldsHarness(["manual-schedule-fields"]),
    fields = createScheduleFields(h.dom);
  fields.open(null, "2026-11-12");
  h.byId("manual-schedule").value = "weekdays";
  h.send(h.byId("manual-schedule"));
  for (const input of h.elements.filter((element) => element.type === "checkbox"))
    input.checked = false;
  assert.equal(fields.checkValidity(), false);
  const first = h.elements.find((element) => element.type === "checkbox");
  first.checked = true;
  h.send(first);
  assert.equal(fields.checkValidity(), true);
  assert.deepEqual(fields.value(), { type: "weekdays", days: [0] });
  h.byId("manual-schedule").value = "interval";
  h.send(h.byId("manual-schedule"));
  assert.deepEqual(fields.value(), { type: "interval", every: 2, anchor: "2026-11-12" });
  fields.update(true);
  assert.equal(fields.value(), undefined);
});

test("pause controls add and remove a single-day exception and resume an ongoing draft", () => {
  const h = fieldsHarness(["pause-fields"]),
    fields = createPauseFields(h.dom),
    root = h.byId("pause-fields");
  fields.open({ startDate: "2026-11-01", endDate: null }, "2026-11-12", "2026-11-12");
  fields.update(false);
  h.send(h.find(root, "Add pause or exception"), "click");
  assert.deepEqual(fields.value(), [{ from: "2026-11-12", to: "2026-11-12" }]);
  h.send(h.find(root, "Remove pause"), "click");
  assert.deepEqual(fields.value(), []);
  fields.open(
    { startDate: "2026-11-01", endDate: null, pauses: [{ from: "2026-11-10", to: null }] },
    "2026-11-12",
    "2026-11-12"
  );
  h.send(h.find(root, "Resume today"), "click");
  assert.deepEqual(fields.value(), [{ from: "2026-11-10", to: "2026-11-11" }]);
  fields.update(true);
  assert.equal(fields.value(), undefined);
});

test("weekly controls save an explicit Monday boundary and constrain check-ins to distinct days", () => {
  const h = fieldsHarness(["weekly-goal-fields"]);
  let changes = 0;
  const fields = createWeeklyFields(h.dom, () => changes++);
  fields.open(null, "2026-11-12");
  h.byId("week-goal").value = "quantity";
  h.send(h.byId("week-goal"));
  assert.equal(changes, 1);
  assert.equal(fields.update(false, false, true), true);
  assert.deepEqual(fields.value(), { type: "quantity", target: 3, weekStart: 0 });
  fields.update(false, true, true);
  assert.equal(fields.value().type, "days");
  assert.equal(h.byId("week-target").max, "7");
  fields.update(true, false, true);
  assert.equal(fields.value(), null);
});
