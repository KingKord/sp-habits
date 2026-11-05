import test from "node:test";
import assert from "node:assert/strict";
import { createScope } from "../src/ui/scope.js";

test("scope removes listeners and timers once, and immediately cleans up late registrations", () => {
  const target = new EventTarget(),
    scope = createScope(),
    calls = [];
  scope.on(target, "change", () => calls.push("change"));
  scope.add(() => calls.push("clear timer"));
  target.dispatchEvent(new Event("change"));
  scope.dispose();
  scope.dispose();
  target.dispatchEvent(new Event("change"));
  scope.on(target, "change", () => calls.push("late change"));
  scope.add(() => calls.push("late cleanup"));
  target.dispatchEvent(new Event("change"));
  assert.equal(scope.disposed, true);
  assert.deepEqual(calls, ["change", "clear timer", "late cleanup"]);
});
