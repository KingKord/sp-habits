import test from "node:test";
import assert from "node:assert/strict";
import { resultClass, resultLabel } from "../src/ui/format.js";

test("acceptable yellow uses a success check with an explicit acceptable label", () => {
  assert.equal(resultLabel({ zone: "warning", kind: "success" }), "Acceptable");
  assert.equal(
    resultLabel({ zone: "warning", kind: "today-good" }),
    "Acceptable · day in progress"
  );
  assert.equal(resultClass({ zone: "warning", kind: "success" }), "warning");
  assert.equal(resultLabel({ zone: "ideal", kind: "success" }), "Ideal");
  assert.match(resultLabel({ zone: "red", kind: "failure" }), /Over limit/);
});
