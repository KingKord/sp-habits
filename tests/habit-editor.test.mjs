import test from "node:test";
import assert from "node:assert/strict";
import { createHabitEditor } from "../src/ui/habit-editor.js";
import { createStore } from "../src/store.js";
import { createCountEditor } from "../src/ui/count-editor.js";
import * as D from "../src/domain.js";

const today = "2026-11-12";
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

async function harness(existing = false) {
  let raw = JSON.stringify(
    existing
      ? D.createHabit(
          D.emptyState("UTC"),
          { name: "Reading", limit: 1, initialCount: 0, startDate: today },
          today,
          "reading"
        )
      : D.emptyState("UTC")
  );
  let writes = 0,
    active = null,
    answer = false,
    failWrites = false;
  const prompts = [],
    created = [],
    elements = new Map(),
    handlers = new Map();
  function element(id = "") {
    let value = "",
      elementId = id;
    return {
      get id() {
        return elementId;
      },
      set id(input) {
        elementId = input;
        elements.set(input, this);
      },
      listeners: new Map(),
      addEventListener(type, fn) {
        this.listeners.set(type, fn);
      },
      setCustomValidity(message) {
        this.validationMessage = message;
      },
      checkValidity() {
        return !this.validationMessage;
      },
      type: "text",
      checked: false,
      disabled: false,
      children: [],
      dataset: {},
      open: false,
      get value() {
        return value;
      },
      set value(input) {
        value = String(input);
      },
      get options() {
        return this.children;
      },
      get firstElementChild() {
        return this.children[0];
      },
      append(...children) {
        this.children.push(...children);
      },
      replaceChildren(...children) {
        this.children = children;
      },
      setAttribute() {},
      focus() {
        active = this;
      },
      select() {},
      showModal() {
        this.open = true;
      },
      close() {
        this.open = false;
      },
      reportValidity() {
        return true;
      },
      getBoundingClientRect() {
        return { left: 100, right: 400, top: 100, bottom: 400 };
      },
      querySelectorAll() {
        return [];
      }
    };
  }
  const byId = (id) => {
    if (!elements.has(id)) elements.set(id, element(id));
    return elements.get(id);
  };
  const fields = [
    "name",
    "task-series",
    "emoji",
    "goal",
    "unit-choice",
    "has-deadline",
    "deadline",
    "reflection-task",
    "step",
    "unit",
    "limit",
    "from",
    "period-days",
    "zones-enabled",
    "zones-ideal",
    "zones-yellow-enabled",
    "initial"
  ];
  byId("habit-form").querySelectorAll = () => [
    ...fields.map(byId),
    ...created.filter((el) => ["INPUT", "SELECT"].includes(el.tagName))
  ];
  for (const id of ["has-deadline", "reflection-task", "zones-enabled", "zones-yellow-enabled"])
    byId(id).type = "checkbox";
  for (const value of ["check-in", "times", "items", "ml", "g", "min", "custom"]) {
    const option = element();
    option.value = value;
    byId("unit-choice").append(option);
  }
  const store = createStore({
    loadSyncedData: async () => raw,
    persistDataSynced: async (value) => {
      if (failWrites) throw new Error("Storage unavailable");
      raw = value;
      writes++;
    }
  });
  await store.reload();
  const dom = {
    byId,
    node: (tag, text = "") => {
      const el = element();
      el.tagName = tag.toUpperCase();
      el.textContent = text;
      created.push(el);
      return el;
    },
    button: (text, action) => {
      const el = element();
      el.tagName = "BUTTON";
      el.textContent = text;
      el.listeners.set("click", action);
      created.push(el);
      return el;
    },
    on: (id, type, fn) => {
      handlers.set(id + ":" + type, fn);
    },
    activeElement: () => active,
    isActive: () => true,
    restoreFocus: () => {}
  };
  const commit = async (transform) => {
    try {
      await store.mutate(transform);
      return true;
    } catch {
      return false;
    }
  };
  const editor = createHabitEditor({
    dom,
    store,
    now: () => today,
    commit,
    confirm: (message) => {
      prompts.push(message);
      return answer;
    },
    newId: () => "new-habit",
    loadEmojis: async () => [],
    loadSchedules: async () => []
  });
  const send = (id, type, event = {}) =>
    handlers.get(id + ":" + type)({ preventDefault() {}, ...event });
  return {
    byId,
    store,
    send,
    clickButton: async (text) => {
      const el = created.findLast((node) => node.tagName === "BUTTON" && node.textContent === text);
      assert.ok(el, text);
      await el.listeners.get("click")({ preventDefault() {} });
    },
    prompts,
    open: async () => {
      editor.open(existing ? store.snapshot().state.habits[0] : null);
      await settle();
    },
    answer: (value) => {
      answer = value;
    },
    failWrites: () => {
      failWrites = true;
    },
    count: () => createCountEditor({ dom, store, now: () => today, commit }),
    replace: async (transform) => {
      raw = JSON.stringify(transform(JSON.parse(raw)));
      store.invalidate();
      await settle();
    },
    data: () => JSON.parse(raw),
    writes: () => writes
  };
}

test("habit dismissal protects dirty values for close, Escape and backdrop while unchanged forms close freely", async () => {
  for (const route of ["button", "escape", "backdrop"]) {
    const h = await harness();
    await h.open();
    await h.send("close-editor", "click");
    assert.equal(h.byId("editor").open, false);
    assert.equal(h.prompts.length, 0);
    await h.open();
    h.byId("name").value = "Unsaved input";
    const dismiss = async () => {
      if (route === "button") await h.send("close-editor", "click");
      else if (route === "escape") await h.send("editor", "cancel");
      else {
        const event = { target: h.byId("editor"), clientX: 10, clientY: 10 };
        await h.send("editor", "pointerdown", event);
        await h.send("editor", "click", event);
      }
    };
    await dismiss();
    assert.equal(h.byId("editor").open, true, route);
    assert.equal(h.byId("name").value, "Unsaved input");
    h.answer(true);
    await dismiss();
    assert.equal(h.byId("editor").open, false, route);
    assert.equal(h.writes(), 0);
    await h.open();
    h.byId("name").value = "Changed";
    h.byId("name").value = "";
    const before = h.prompts.length;
    await h.send("close-editor", "click");
    assert.equal(h.prompts.length, before);
  }
});

test("failed habit saves retain dirty inputs and keep dismissal protection", async () => {
  const h = await harness(true);
  await h.open();
  h.byId("name").value = "Unsaved rename";
  h.failWrites();
  await h.send("habit-form", "submit");
  assert.equal(h.byId("editor").open, true);
  assert.equal(h.byId("name").value, "Unsaved rename");
  assert.match(h.byId("editor-error").textContent, /Storage unavailable/);
  await h.send("close-editor", "click");
  assert.equal(h.byId("editor").open, true);
  assert.equal(h.prompts.length, 1);
  assert.equal(h.data().habits[0].name, "Reading");
});

test("an absolute quantity editor rejects a changed selected day while keeping its input", async () => {
  const h = await harness(true);
  h.count().open(h.store.snapshot().state.habits[0], today, "quantity-opener");
  h.byId("count-amount").value = 3;
  await h.replace((state) => {
    state.habits[0].counts[today] = 2;
    return state;
  });
  await h.send("count-form", "submit");
  assert.equal(h.data().habits[0].counts[today], 2);
  assert.equal(h.byId("count-amount").value, "3");
  assert.equal(h.byId("count-editor").open, true);
  assert.match(h.byId("count-error").textContent, /changed while the form was open/);
  assert.equal(h.store.snapshot().blocked, false);
  assert.equal(h.writes(), 0);
});

test("nested emoji dismissal keeps the dirty habit form without a discard confirmation", async () => {
  const h = await harness();
  await h.open();
  h.byId("name").value = "Draft";
  await h.send("choose-emoji", "click");
  await h.send("emoji-picker", "cancel");
  assert.equal(h.byId("editor").open, true);
  assert.equal(h.byId("name").value, "Draft");
  assert.equal(h.prompts.length, 0);
});

test("successful save and confirmed destructive actions close without a second discard prompt", async () => {
  const created = await harness();
  await created.open();
  created.byId("name").value = "New reading";
  await created.send("habit-form", "submit");
  assert.equal(created.byId("editor").open, false);
  assert.equal(created.data().habits[0].name, "New reading");
  assert.equal(created.prompts.length, 0);
  for (const action of ["archive-habit", "delete-habit"]) {
    const h = await harness(true);
    await h.open();
    h.byId("name").value = "Unsaved rename";
    h.answer(true);
    await h.send(action, "click");
    assert.equal(h.byId("editor").open, false);
    assert.equal(h.prompts.length, 1);
  }
});

test("a stale habit editor retains input and rejects overwriting externally changed settings", async () => {
  const h = await harness(true);
  await h.open();
  h.byId("name").value = "My unsaved name";
  await h.replace((state) => {
    state.habits[0].name = "Delivered name";
    return state;
  });
  assert.equal(h.byId("name").value, "My unsaved name");
  await h.send("habit-form", "submit");
  assert.equal(h.data().habits[0].name, "Delivered name");
  assert.equal(h.byId("editor").open, true);
  assert.equal(h.byId("name").value, "My unsaved name");
  assert.match(h.byId("editor-error").textContent, /changed while the form was open/);
  assert.equal(h.store.snapshot().blocked, false);
  assert.equal(h.writes(), 0);
});

test("quantity updates and visibility changes do not prevent saving a settings draft", async () => {
  const h = await harness(true);
  await h.open();
  h.byId("name").value = "Renamed reading";
  await h.replace((state) => {
    state.habits[0].counts[today] = 2;
    state.habits[0].hidden = true;
    return state;
  });
  await h.send("habit-form", "submit");
  assert.equal(h.byId("editor").open, false);
  assert.equal(h.data().habits[0].name, "Renamed reading");
  assert.equal(h.data().habits[0].counts[today], 2);
  assert.equal(h.data().habits[0].hidden, true);
});

test("dated schedules and pauses delivered during an edit cannot be overwritten by a stale form", async () => {
  for (const [field, value] of [
    ["manualSchedules", [{ from: today, type: "weekdays", days: [0, 2, 4] }]],
    ["pauses", [{ from: today, to: today }]]
  ]) {
    const h = await harness(true);
    await h.open();
    h.byId("name").value = "Local draft";
    await h.replace((state) => {
      state.habits[0][field] = value;
      return state;
    });
    await h.send("habit-form", "submit");
    assert.deepEqual(h.data().habits[0][field], value);
    assert.equal(h.byId("name").value, "Local draft");
    assert.match(h.byId("editor-error").textContent, /changed while the form was open/);
    assert.equal(h.store.snapshot().blocked, false);
    assert.equal(h.writes(), 0);
  }
});

test("adding, removing and resuming pause drafts participate in discard protection", async () => {
  const h = await harness(true);
  await h.open();
  await h.clickButton("Add pause or exception");
  await h.send("close-editor", "click");
  assert.equal(h.byId("editor").open, true);
  assert.equal(h.prompts.length, 1);
  await h.clickButton("Remove pause");
  await h.send("close-editor", "click");
  assert.equal(h.byId("editor").open, false);
  assert.equal(h.prompts.length, 1);
  await h.replace((state) => {
    state.habits[0].pauses = [{ from: today, to: null }];
    return state;
  });
  await h.open();
  await h.clickButton("Resume today");
  await h.send("editor", "cancel");
  assert.equal(h.byId("editor").open, true);
  assert.equal(h.prompts.length, 2);
  assert.equal(h.writes(), 0);
});
