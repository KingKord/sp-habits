import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { createHabitDetails } from "../src/ui/habit-details.js";

function harness() {
  const today = "2026-11-12";
  const state = D.createHabit(
    D.emptyState("UTC"),
    {
      name: "Reading",
      goal: "at-least",
      unit: "min",
      limit: 20,
      startDate: "2026-01-01",
      initialCount: 0
    },
    today,
    "reading"
  );
  const fields = new Map(),
    handlers = new Map();
  let active,
    writes = 0;
  function node(tag, text = "", className = "") {
    return {
      tag,
      textContent: text,
      className,
      children: [],
      dataset: {},
      style: {},
      isConnected: true,
      append(...nodes) {
        for (const child of nodes)
          if (child.tag === "fragment") this.children.push(...child.children);
          else this.children.push(child);
      },
      replaceChildren(...nodes) {
        this.children = [];
        this.append(...nodes);
      },
      setAttribute(name, value) {
        this[name] = value;
      },
      showModal() {
        this.open = true;
      },
      close() {
        this.open = false;
      },
      focus() {
        active = this;
      },
      setCustomValidity(value) {
        this.validationMessage = value;
      },
      reportValidity: () => true,
      getBoundingClientRect: () => ({ left: 0, right: 100, top: 0, bottom: 100 })
    };
  }
  const byId = (id) => {
    if (!fields.has(id)) fields.set(id, node("control"));
    return fields.get(id);
  };
  const opener = node("button");
  opener.focus();
  const view = createHabitDetails({
    dom: {
      byId,
      node,
      on: (id, type, callback) => handlers.set(id + ":" + type, callback),
      fragment: () => node("fragment"),
      activeElement: () => active,
      restoreFocus: () => {}
    },
    store: {
      snapshot: () => ({ state }),
      mutate: () => {
        writes++;
        assert.fail("Reading details must not write history");
      }
    },
    now: () => today
  });
  const send = (id, type) => handlers.get(id + ":" + type)({ preventDefault() {} });
  const text = (element) => [element.textContent, ...element.children.map(text)].join(" ");
  return { view, state, byId, send, text, opener, active: () => active, writes: () => writes };
}

test("opening, paging and changing a detail range remain read-only and close restores the opener", () => {
  const h = harness(),
    raw = D.encodeState(h.state);
  h.view.open(h.state.habits[0], "2026-11-12");
  assert.equal(h.byId("habit-details").open, true);
  assert.equal(h.byId("details-rows").children.length, 30);
  assert.equal(h.byId("details-title").textContent, "Reading");
  h.byId("details-from").value = "2026-01-01";
  h.send("details-range", "submit");
  assert.equal(h.byId("details-rows").children.length, 31);
  h.send("details-older", "click");
  assert.match(h.byId("details-page").textContent, /Page 2/);
  assert.match(h.text(h.byId("details-rows")), /min/);
  h.send("close-details", "click");
  assert.equal(h.active(), h.opener);
  assert.equal(h.writes(), 0);
  assert.equal(D.encodeState(h.state), raw);
});

test("background detail refresh preserves a pending date draft and date edits clear an invalid range", () => {
  const h = harness();
  h.view.open(h.state.habits[0], "2026-11-12");
  h.byId("details-from").value = "2026-01-01";
  h.view.render();
  assert.equal(h.byId("details-from").value, "2026-01-01");
  h.byId("details-from").value = "2026-11-12";
  h.byId("details-to").value = "2026-11-01";
  h.send("details-range", "submit");
  assert.match(h.byId("details-to").validationMessage, /must not be before/);
  h.byId("details-to").value = "2026-11-12";
  h.send("details-to", "input");
  assert.equal(h.byId("details-to").validationMessage, "");
  h.send("details-range", "submit");
  assert.equal(h.byId("details-rows").children.length, 1);
  assert.equal(h.writes(), 0);
});
