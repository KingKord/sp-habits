import test from "node:test";
import assert from "node:assert/strict";
import { createDraftStorage } from "../src/ui/draft-recovery.js";

const draft = {
  kind: "note",
  context: { id: "a", date: "2026-11-12", initial: "Earlier note" },
  fields: [
    { index: 0, id: "note-text", value: "A new draft 🌱", selectionStart: 3, selectionEnd: 8 }
  ]
};
function harness(raw = null) {
  const values = new Map(raw ? [["habits-editor-drafts-v1", raw]] : []);
  values.set("unrelated-setting", "keep");
  let fail = false;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (fail) throw Error("Quota");
      values.set(key, value);
    },
    removeItem: (key) => {
      if (fail) throw Error("Denied");
      values.delete(key);
    }
  };
  return {
    window: { sessionStorage: storage },
    values,
    fail: () => {
      fail = true;
    }
  };
}

test("session drafts round-trip raw user input, selection and original conflict baseline without touching other storage", () => {
  const h = harness();
  const storage = createDraftStorage(h.window);
  assert.equal(storage.save({ note: draft }), true);
  const reopened = createDraftStorage(h.window);
  assert.deepEqual(reopened.read().editors.note, draft);
  assert.equal(reopened.save({}), true);
  assert.equal(h.values.has("habits-editor-drafts-v1"), false);
  assert.equal(h.values.get("unrelated-setting"), "keep");
});

test("malformed and unsupported saved drafts remain available as recovery text until explicit discard", () => {
  for (const raw of [
    "not JSON",
    JSON.stringify({ schemaVersion: 1, editors: true }),
    JSON.stringify({ schemaVersion: 1, editors: 1 }),
    JSON.stringify({ schemaVersion: 2, editors: {} }),
    JSON.stringify({ schemaVersion: 1, editors: { unknown: draft } })
  ]) {
    const h = harness(raw);
    const storage = createDraftStorage(h.window);
    assert.equal(storage.read().unreadable, true);
    assert.equal(storage.read().raw, raw);
    assert.equal(h.values.get("habits-editor-drafts-v1"), raw);
    assert.equal(storage.save({}), true);
    assert.equal(storage.read().unreadable, false);
  }
});

test("quota/denied writes and capacity failures retain previous stored drafts and report failure", () => {
  const h = harness();
  const storage = createDraftStorage(h.window);
  storage.save({ note: draft });
  const original = h.values.get("habits-editor-drafts-v1");
  h.fail();
  assert.equal(storage.save({ note: { ...draft, context: { initial: "replacement" } } }), false);
  assert.equal(h.values.get("habits-editor-drafts-v1"), original);
  assert.equal(storage.save({ note: { ...draft, extra: "x".repeat(262144) } }), false);
  assert.equal(h.values.get("habits-editor-drafts-v1"), original);
});

async function recoveryHarness(raw) {
  const { mountDraftRecovery } = await import("../src/ui/draft-recovery.js");
  const { createScope } = await import("../src/ui/scope.js");
  const h = harness(raw);
  const nodes = [];
  const document = new EventTarget();
  class Element extends EventTarget {
    constructor(tag, text = "") {
      super();
      this.tagName = tag;
      this.textContent = text;
      this.children = [];
      this.open = false;
      nodes.push(this);
    }
    append(...children) {
      this.children.push(...children);
    }
    prepend(child) {
      this.children.unshift(child);
    }
    setAttribute() {}
    contains(target) {
      return this === target || this.children.some((child) => child.contains(target));
    }
    showModal() {
      if (this.removed) throw Error("Detached dialog");
      this.open = true;
    }
    close() {
      this.open = false;
      document.dispatchEvent(new Event("close"));
    }
    focus() {}
    remove() {
      this.removed = true;
    }
  }
  document.body = new Element("body");
  const shell = new Element("main");
  document.querySelector = (selector) =>
    selector === ".shell" ? shell : nodes.find((node) => node.tagName === "dialog" && node.open);
  h.window.document = document;
  let dirty = true;
  const editors = Object.fromEntries(
    ["habit", "count", "plan", "note"].map((key) => [
      key,
      {
        captureDraft: () => (key === "note" && dirty ? draft : null),
        restoreDraft: () => true
      }
    ])
  );
  const dom = {
    node: (tag, text) => new Element(tag, text),
    button: (text, action) => {
      const element = new Element("button", text);
      element.addEventListener("click", action);
      return element;
    }
  };
  const scope = createScope();
  const recovery = mountDraftRecovery({ window: h.window, dom, scope, editors, ready: () => true });
  return {
    ...h,
    nodes,
    document,
    scope,
    recovery,
    editors,
    setDirty: (value) => {
      dirty = value;
    }
  };
}

test("synchronous dialog-close events during teardown cannot erase the captured session draft", async () => {
  const h = await recoveryHarness();
  h.scope.add(() => {
    h.setDirty(false);
    h.document.dispatchEvent(new Event("close"));
  });
  h.scope.add(h.recovery.persist);
  h.scope.dispose();
  assert.deepEqual(createDraftStorage(h.window).read().editors.note, draft);
});

test("failed Discard keeps the pending recovery choice, recoverable text and visible storage warning", async () => {
  const raw = JSON.stringify({ schemaVersion: 1, editors: { note: draft } });
  const h = await recoveryHarness(raw);
  h.setDirty(false);
  h.recovery.offer();
  const dialog = h.nodes.find((node) => node.tagName === "dialog");
  assert.equal(dialog.open, true);
  h.fail();
  h.nodes
    .find((node) => node.textContent === "Discard saved drafts")
    .dispatchEvent(new Event("click"));
  assert.equal(dialog.open, true);
  assert.equal(h.values.get("habits-editor-drafts-v1"), raw);
  const textarea = h.nodes.find((node) => node.tagName === "textarea");
  assert.equal(textarea.value, raw);
  assert.equal(textarea.hidden, false);
  h.document.dispatchEvent(new Event("click"));
  assert.ok(
    h.nodes.some(
      (node) => node.textContent?.startsWith("Draft storage is unavailable") && !node.hidden
    )
  );
  h.scope.dispose();
});

test("leaving during asynchronous restoration keeps saved text and performs no detached-dialog recovery", async () => {
  const raw = JSON.stringify({ schemaVersion: 1, editors: { note: draft } });
  const h = await recoveryHarness(raw);
  let finish;
  h.editors.note.restoreDraft = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  h.recovery.offer();
  h.nodes
    .find((node) => node.textContent === "Resume saved drafts")
    .dispatchEvent(new Event("click"));
  h.scope.add(h.recovery.persist);
  h.scope.dispose();
  finish(false);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.values.get("habits-editor-drafts-v1"), raw);
});
