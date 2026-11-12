import test from "node:test";
import assert from "node:assert/strict";
import { createPlanEditor } from "../src/ui/plan-editor.js";
import { createStore } from "../src/store.js";
import * as D from "../src/domain.js";

const today = "2026-11-12";
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

async function harness() {
  const elements = new Map(),
    handlers = new Map(),
    prompts = [];
  let active = null,
    answer = false,
    hold = false,
    releaseWrite,
    fail = false;
  class Element {
    constructor(tag = "div", text = "") {
      this.tagName = tag.toUpperCase();
      this.textContent = text;
      this.children = [];
      this.listeners = new Map();
      this.dataset = {};
      this.disabled = false;
      this.hidden = false;
      this.open = false;
      this.scrollTop = 0;
      this._value = "";
    }
    set id(value) {
      this._id = value;
      elements.set(value, this);
    }
    get id() {
      return this._id || "";
    }
    set value(value) {
      this._value = String(value);
    }
    get value() {
      return this._value;
    }
    append(...children) {
      for (const child of children) {
        child.parent = this;
        this.children.push(child);
      }
    }
    replaceChildren(...children) {
      this.children = [];
      this.append(...children);
    }
    remove() {
      this.parent.children = this.parent.children.filter((child) => child !== this);
    }
    addEventListener(type, fn) {
      this.listeners.set(type, fn);
    }
    setAttribute() {}
    focus() {
      active = this;
    }
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
    }
    reportValidity() {
      return true;
    }
    getBoundingClientRect() {
      return { left: 100, right: 400, top: 100, bottom: 400 };
    }
    querySelectorAll(selector) {
      const all = this.children.flatMap((child) => [child, ...child.querySelectorAll("*")]);
      return all.filter((child) =>
        selector.split(",").some((part) => {
          const value = part.trim();
          if (value === "*") return true;
          if (value.startsWith("."))
            return (child.className || "").split(" ").includes(value.slice(1));
          if (value === "input[type=date]")
            return child.tagName === "INPUT" && child.type === "date";
          return child.tagName === value.toUpperCase();
        })
      );
    }
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
  }
  const node = (tag, text, className) => {
    const el = new Element(tag, text);
    el.className = className || "";
    return el;
  };
  const byId = (id) => {
    if (!elements.has(id)) {
      const el = node("div");
      el.id = id;
    }
    return elements.get(id);
  };
  const make = (id, tag = "input") => {
    const el = node(tag);
    el.id = id;
    return el;
  };
  const form = byId("plan-form");
  form.append(make("close-plan", "button"), make("plan-mode", "select"));
  byId("amount-plan-fields").append(
    ...["plan-first", "plan-interval", "plan-decrease", "plan-target"].map((id) => make(id))
  );
  byId("frequency-plan-fields").append(
    byId("frequency-stages"),
    make("add-frequency-stage", "button")
  );
  form.append(
    byId("amount-plan-fields"),
    byId("frequency-plan-fields"),
    make("save-plan", "button"),
    make("cancel-reduction", "button")
  );
  byId("plan-editor").append(form);
  let raw = D.encodeState(
      D.createHabit(
        D.emptyState("UTC"),
        { name: "Coffee", limit: 300, initialCount: 0, startDate: today, step: 150, unit: "ml" },
        today,
        "coffee"
      )
    ),
    writes = 0;
  const store = createStore({
    loadSyncedData: async () => raw,
    persistDataSynced: async (value) => {
      if (hold)
        await new Promise((resolve) => {
          releaseWrite = resolve;
        });
      if (fail) throw Error("Storage unavailable");
      raw = value;
      writes++;
    }
  });
  await store.reload();
  const editor = createPlanEditor({
    dom: {
      byId,
      node,
      button: (text, action) => {
        const el = node("button", text);
        el.listeners.set("click", action);
        return el;
      },
      on: (id, type, fn) => handlers.set(id + ":" + type, fn),
      activeElement: () => active,
      isActive: () => true,
      restoreFocus: () => {}
    },
    store,
    now: () => today,
    confirm: (message) => {
      prompts.push(message);
      return answer;
    },
    commit: async (transform) => {
      try {
        await store.mutate(transform);
        return true;
      } catch {
        return false;
      }
    }
  });
  return {
    byId,
    editor,
    store,
    prompts,
    open: () => editor.open(store.snapshot().state.habits[0]),
    send: (id, type = "click") => handlers.get(id + ":" + type)({ preventDefault() {} }),
    answer: () => {
      answer = true;
    },
    data: () => JSON.parse(raw),
    writes: () => writes,
    hold: () => {
      hold = true;
    },
    release: () => {
      hold = false;
      releaseWrite();
    },
    fail: (value = true) => {
      fail = value;
    },
    recover: () =>
      form
        .querySelectorAll("button")
        .find((el) => el.textContent === "Reload data and keep editing")
        .listeners.get("click")(),
    external: async () => {
      raw = D.encodeState(
        D.editHabit(
          JSON.parse(raw),
          "coffee",
          { name: "Changed Coffee", limit: 250, from: today },
          today
        )
      );
      await store.reload();
    }
  };
}

test("plan dismissal protects changed values while unchanged plans close freely", async () => {
  const h = await harness();
  h.open();
  assert.equal(h.byId("cancel-reduction").disabled, true);
  await h.send("close-plan");
  assert.equal(h.byId("plan-editor").open, false);
  assert.equal(h.prompts.length, 0);
  h.open();
  h.byId("plan-target").value = "100";
  await h.send("plan-editor", "cancel");
  assert.equal(h.byId("plan-editor").open, true);
  assert.equal(h.byId("plan-target").value, "100");
  h.answer();
  await h.send("close-plan");
  assert.equal(h.byId("plan-editor").open, false);
  assert.equal(h.editor.captureDraft(), null);
  assert.equal(h.writes(), 0);
});

test("plan inputs, stage actions and dismissal remain locked throughout persistence", async () => {
  const h = await harness();
  h.open();
  h.byId("plan-target").value = "100";
  h.hold();
  const save = h.send("plan-form", "submit");
  await settle();
  for (const id of [
    "plan-mode",
    "plan-target",
    "plan-first",
    "add-frequency-stage",
    "close-plan",
    "save-plan"
  ])
    assert.equal(h.byId(id).disabled, true, id);
  h.release();
  await save;
  assert.equal(h.byId("plan-editor").open, false);
  assert.equal(h.data().habits[0].limits.at(-1).value, 100);
  assert.equal(h.prompts.length, 0);
});

test("restored frequency drafts retain raw stages and reject a stale settings baseline", async () => {
  const h = await harness();
  h.open();
  h.byId("plan-mode").value = "frequency";
  await h.send("plan-mode", "change");
  await h.send("add-frequency-stage");
  const stages = h.byId("frequency-stages").children;
  stages[0].querySelector(".stage-value").value = "";
  const saved = JSON.parse(JSON.stringify(h.editor.captureDraft()));
  assert.equal(saved.stages.length, 3);
  const restored = await harness();
  await restored.external();
  assert.equal(restored.editor.restoreDraft(saved), true);
  assert.equal(restored.byId("frequency-stages").children.length, 3);
  assert.equal(
    restored.byId("frequency-stages").children[0].querySelector(".stage-value").value,
    ""
  );
  assert.equal(restored.byId("plan-editor").open, true);
  await restored.send("plan-form", "submit");
  assert.equal(restored.writes(), 0);
  assert.equal(restored.data().habits[0].name, "Changed Coffee");
});

test("failed plan saves recover inside the dialog without replacing its target draft", async () => {
  const h = await harness();
  h.open();
  h.byId("plan-target").value = "100";
  h.fail();
  await h.send("plan-form", "submit");
  assert.equal(h.byId("save-plan").disabled, true);
  h.fail(false);
  await h.recover();
  assert.equal(h.byId("plan-target").value, "100");
  assert.equal(h.byId("plan-editor").open, true);
  await h.send("plan-form", "submit");
  assert.equal(h.data().habits[0].limits.at(-1).value, 100);
});
