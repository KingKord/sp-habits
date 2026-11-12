import test from "node:test";
import assert from "node:assert/strict";
import {
  iframeBudget,
  assertIframeBudget,
  IFRAME_WARNING,
  IFRAME_LIMIT
} from "../scripts/iframe-budget.mjs";

test("the iframe budget warns before the strict host boundary and reports reviewable headroom", () => {
  const below = iframeBudget(IFRAME_WARNING - 1);
  assert.equal(below.warning, false);
  assert.equal(iframeBudget(IFRAME_WARNING).warning, true);
  assert.equal(below.remaining, IFRAME_LIMIT - below.bytes);
  assert.equal(iframeBudget(94524).delta, 0);
  assert.doesNotThrow(() => assertIframeBudget(iframeBudget(IFRAME_LIMIT - 1)));
  assert.throws(() => assertIframeBudget(iframeBudget(IFRAME_LIMIT)), /100 KiB/);
  assert.throws(() => assertIframeBudget(iframeBudget(IFRAME_LIMIT + 1)), /100 KiB/);
});
