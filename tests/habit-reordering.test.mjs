import test from "node:test";
import assert from "node:assert/strict";
import { createHabitReordering } from "../src/ui/habit-reordering.js";

function harness() {
  const calls = [],
    messages = [],
    handlers = new Map(),
    rows = [];
  let hit = null;
  let callback = null;
  const view = {
    innerHeight: 800,
    requestAnimationFrame: (fn) => {
      callback = fn;
      return 1;
    },
    cancelAnimationFrame: () => {
      callback = null;
    },
    scrollBy: (...args) => calls.push(["scroll", ...args])
  };
  const documentHandlers = new Map();
  const document = {
    defaultView: view,
    elementFromPoint: () => hit,
    addEventListener: (type, fn) => documentHandlers.set(type, fn),
    removeEventListener: (type, fn) => {
      if (documentHandlers.get(type) === fn) documentHandlers.delete(type);
    }
  };
  const root = {
    ownerDocument: document,
    contains: (row) => rows.includes(row),
    querySelectorAll: () =>
      rows.filter(
        (row) => row.classList.contains("drop-before") || row.classList.contains("drop-after")
      )
  };
  function node(tag, text, className) {
    const classes = new Set((className ?? "").split(" "));
    const events = new Map();
    return {
      tag,
      text,
      dataset: {},
      children: [],
      disabled: false,
      title: "",
      attributes: {},
      classList: {
        add: (...names) => names.forEach((n) => classes.add(n)),
        remove: (...names) => names.forEach((n) => classes.delete(n)),
        contains: (n) => classes.has(n)
      },
      append(...children) {
        this.children.push(...children);
      },
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      addEventListener: (type, fn) => events.set(type, fn),
      send: (type, event) => events.get(type)?.(event),
      closest(selector) {
        return selector === ".habit-drag-handle" && classes.has("habit-drag-handle")
          ? this
          : selector === ".habit-row"
            ? classes.has("habit-row")
              ? this
              : this.row
            : null;
      },
      contains(target) {
        return this === target || this.children.some((child) => child.contains(target));
      },
      focus() {
        this.focused = true;
      },
      setPointerCapture(id) {
        this.capture = id;
      },
      hasPointerCapture(id) {
        return this.capture === id;
      },
      releasePointerCapture() {
        this.capture = null;
      }
    };
  }
  const controller = createHabitReordering({
    dom: {
      byId: () => root,
      node,
      button: (text, click, label, className) => {
        const element = node("button", text, className);
        element.click = click;
        element.attributes["aria-label"] = label;
        return element;
      },
      on: (_id, type, fn) => handlers.set(type, fn)
    },
    move: async (...args) => {
      calls.push(args);
    },
    flash: (text) => messages.push(text)
  });
  const habits = ["a", "b", "c"].map((id) => ({ id, name: id, groupId: "g" }));
  const handles = habits.map((habit, index) => {
    const { handle, menu } = controller.controls(habit, habits, false);
    const row = node("article", "", "habit-row");
    row.dataset = { habitId: habit.id, groupId: "g" };
    row.getBoundingClientRect = () => ({ top: 100 + index * 80, height: 80 });
    handle.row = row;
    row.handle = handle;
    row.menu = menu;
    rows.push(row);
    return handle;
  });
  function send(type, extra = {}) {
    const event = {
      target: handles[0],
      button: 0,
      isPrimary: true,
      pointerId: 1,
      clientX: 20,
      clientY: 120,
      preventDefault() {
        this.prevented = true;
      },
      ...extra
    };
    handlers.get(type)?.(event);
    return event;
  }
  return {
    controller,
    handles,
    rows,
    calls,
    messages,
    send,
    hit: (row) => {
      hit = row;
    },
    animation: () => callback,
    habits,
    documentHandlers
  };
}

test("a handle drag inserts before or after a distant peer only on release", () => {
  const h = harness();
  h.hit(h.rows[2]);
  h.send("pointerdown");
  h.send("pointermove", { clientY: 270 });
  assert.equal(h.calls.length, 0);
  assert.equal(h.rows[0].classList.contains("habit-dragging"), true);
  assert.equal(h.rows[2].classList.contains("drop-before"), true);
  h.send("pointerup");
  assert.deepEqual(h.calls, [["a", "c", "before", "g", "a-drag"]]);
  assert.equal(h.rows[0].classList.contains("habit-dragging"), false);
  assert.equal(h.rows[2].classList.contains("drop-before"), false);
  assert.equal(h.animation(), null);
  h.send("pointerdown");
  h.send("pointermove", { clientY: 330 });
  h.send("pointerup");
  assert.equal(h.calls[1][2], "after");
});

test("touch handles and keyboard arrows share persisted insertion semantics", () => {
  const h = harness();
  const handle = h.handles[1];
  handle.send("keydown", { key: "ArrowUp", preventDefault() {} });
  assert.deepEqual(h.calls[0], ["b", "a", "before", "g", "b-drag"]);
  handle.send("keydown", { key: "ArrowDown", preventDefault() {} });
  assert.deepEqual(h.calls[1], ["b", "c", "after", "g", "b-drag"]);
  h.hit(h.rows[1]);
  h.send("pointerdown", { pointerType: "touch" });
  h.send("pointermove", { pointerType: "touch", clientY: 240 });
  h.send("pointerup", { pointerType: "touch" });
  assert.deepEqual(h.calls[2], ["a", "b", "after", "g", "a-drag"]);
});

test("clicking a handle, counters and secondary pointer buttons never reorder habits", () => {
  const h = harness();
  h.send("pointerdown");
  h.send("pointermove", { clientY: 123 });
  h.send("pointerup");
  for (const extra of [{ button: 2 }, { isPrimary: false }, { target: { closest: () => null } }]) {
    h.send("pointerdown", extra);
    h.send("pointermove", { clientY: 300 });
    h.send("pointerup");
  }
  h.handles[0].disabled = true;
  h.send("pointerdown");
  h.send("pointermove", { clientY: 300 });
  h.send("pointerup");
  assert.deepEqual(h.calls, []);
});

test("a drag cannot cross a group or drop outside the list", () => {
  const h = harness();
  h.rows[2].dataset.groupId = "other";
  for (const row of [h.rows[0], h.rows[2], null]) {
    h.hit(row);
    h.send("pointerdown");
    h.send("pointermove", { clientY: 300 });
    h.send("pointerup");
  }
  assert.deepEqual(h.calls, []);
});

test("Escape, pointer cancellation, refresh and disposal remove drag markers without a write", () => {
  for (const type of ["Escape", "pointercancel", "lostpointercapture", "dispose"]) {
    const h = harness();
    h.hit(h.rows[1]);
    h.send("pointerdown");
    h.send("pointermove", { clientY: 220 });
    if (type === "Escape") h.send("keydown", { key: "Escape" });
    else if (type === "dispose") h.controller.cancel();
    else h.send(type);
    h.send("pointerup");
    assert.deepEqual(h.calls, []);
    assert.equal(h.handles[0].capture, null);
    assert.equal(h.animation(), null);
    assert.equal(h.rows[1].classList.contains("drop-after"), false);
  }
});

test("edge scrolling stops when a drag is cancelled and does not run for simple clicks", () => {
  const h = harness();
  h.send("pointerdown");
  assert.equal(h.animation(), null);
  h.send("pointermove", { clientY: 795 });
  h.animation()();
  assert.deepEqual(h.calls, [["scroll", 0, 14]]);
  h.controller.cancel();
  assert.equal(h.animation(), null);
});

test("compact menu controls respect edge positions and saving locks", () => {
  const h = harness();
  const actions = h.rows[0].menu.children[1].children;
  assert.equal(actions[0].disabled, true);
  assert.equal(actions[1].disabled, false);
  actions[1].click();
  assert.deepEqual(h.calls[0], ["a", "b", "after", "g", "a-drag"]);
  const locked = h.controller.controls(h.habits[1], h.habits, true);
  assert.equal(locked.handle.disabled, true);
  assert.ok(locked.menu.children[1].children.every((button) => button.disabled));
});

test("reorder popups dismiss with Escape, outside input and another popup without moving", () => {
  const h = harness();
  const first = h.rows[0].menu,
    second = h.rows[1].menu;
  first.open = true;
  first.send("toggle");
  let prevented = false;
  h.documentHandlers.get("keydown")({
    key: "Escape",
    preventDefault() {
      prevented = true;
    }
  });
  assert.equal(prevented, true);
  assert.equal(first.open, false);
  assert.equal(first.children[0].focused, true);
  assert.equal(h.documentHandlers.size, 0);
  first.open = true;
  first.send("toggle");
  h.documentHandlers.get("pointerdown")({ target: first.children[1] });
  assert.equal(first.open, true);
  second.open = true;
  second.send("toggle");
  assert.equal(first.open, false);
  assert.equal(second.open, true);
  h.documentHandlers.get("pointerdown")({ target: h.handles[2] });
  assert.equal(second.open, false);
  assert.equal(h.documentHandlers.size, 0);
  assert.deepEqual(h.calls, []);
  first.open = true;
  first.send("toggle");
  h.controller.cancel();
  assert.equal(first.open, false);
  assert.equal(h.documentHandlers.size, 0);
});

test("summary activation registers dismissal before a deferred native toggle event", () => {
  const h = harness();
  const first = h.rows[0].menu,
    second = h.rows[1].menu;
  const activate = (menu) => {
    let prevented = false;
    menu.children[0].send("click", {
      preventDefault() {
        prevented = true;
      }
    });
    assert.equal(prevented, true);
  };
  activate(first);
  assert.equal(first.open, true);
  assert.ok(h.documentHandlers.has("keydown"));
  h.documentHandlers.get("keydown")({ key: "Escape", preventDefault() {} });
  assert.equal(first.open, false);
  assert.equal(first.children[0].focused, true);
  // A queued native toggle event must observe the current state and cannot reopen it.
  first.send("toggle");
  assert.equal(first.open, false);
  assert.equal(h.documentHandlers.size, 0);
  activate(first);
  activate(second);
  assert.equal(first.open, false);
  assert.equal(second.open, true);
  h.documentHandlers.get("pointerdown")({ target: h.handles[2] });
  assert.equal(second.open, false);
  const locked = h.controller.controls(h.habits[1], h.habits, true).menu;
  activate(locked);
  assert.ok(!locked.open);
  assert.equal(h.documentHandlers.size, 0);
  assert.deepEqual(h.calls, []);
});
