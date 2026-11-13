import test from "node:test";
import assert from "node:assert/strict";
import { createGroupCollapse } from "../src/ui/group-collapse.js";

const key = "habits-collapsed-groups-v1";
function storage(initial = null) {
  const data = new Map(initial === null ? [] : [[key, initial]]);
  return {
    data,
    window: {
      localStorage: {
        getItem: (id) => data.get(id) ?? null,
        setItem: (id, value) => data.set(id, value)
      }
    }
  };
}

test("several collapsed groups and Ungrouped survive reopening by ID and deleted IDs are pruned", () => {
  const h = storage();
  const preference = createGroupCollapse(h.window);
  preference.toggle("morning");
  preference.toggle("evening");
  preference.toggle("");
  const reopened = createGroupCollapse(h.window);
  assert.equal(reopened.isCollapsed("morning"), true);
  assert.equal(reopened.isCollapsed("evening"), true);
  assert.equal(reopened.isCollapsed(""), true);
  reopened.toggle("morning");
  assert.equal(reopened.isCollapsed("morning"), false);
  assert.equal(reopened.isCollapsed("evening"), true);
  reopened.retain(["evening", ""]);
  reopened.toggle("evening");
  assert.deepEqual(JSON.parse(h.data.get(key)), [""]);
});

test("malformed or oversized collapse preferences leave groups expanded", () => {
  for (const raw of [
    "{broken",
    "null",
    "{}",
    "[1]",
    '["invalid id"]',
    JSON.stringify(Array.from({ length: 102 }, (_, i) => "group-" + i))
  ]) {
    const h = storage(raw);
    const preference = createGroupCollapse(h.window);
    assert.equal(preference.isCollapsed("morning"), false);
    preference.toggle("morning");
    assert.deepEqual(JSON.parse(h.data.get(key)), ["morning"]);
  }
});

test("unavailable preference storage still allows independent current-view collapsing", () => {
  let warnings = 0;
  const window = {};
  Object.defineProperty(window, "localStorage", {
    get() {
      throw Error("Storage unavailable");
    }
  });
  const preference = createGroupCollapse(window, () => warnings++);
  preference.toggle("morning");
  preference.toggle("evening");
  assert.equal(preference.isCollapsed("morning"), true);
  assert.equal(preference.isCollapsed("evening"), true);
  preference.toggle("morning");
  assert.equal(preference.isCollapsed("morning"), false);
  assert.equal(preference.isCollapsed("evening"), true);
  assert.equal(warnings, 3);
  assert.equal(createGroupCollapse(window).isCollapsed("evening"), false);
});
