import test from "node:test";
import assert from "node:assert/strict";
import { createNoteEditor } from "../src/ui/note-editor.js";
import { createStore } from "../src/store.js";
import * as D from "../src/domain.js";

const today = "2026-11-12";
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
async function harness(note = "") {
  let state = D.createHabit(
    D.emptyState("UTC"),
    {
      name: "Reading",
      goal: "at-least",
      tracking: "check-in",
      limit: 1,
      initialCount: 0,
      startDate: today
    },
    today,
    "reading"
  );
  if (note) state = D.setNote(state, "reading", today, note, today);
  let raw = D.encodeState(state),
    fail = false,
    answer = false,
    active,
    writes = 0;
  const fields = new Map(),
    handlers = new Map(),
    prompts = [];
  const byId = (id) => {
    if (!fields.has(id))
      fields.set(id, {
        value: "",
        disabled: false,
        open: false,
        dataset: {},
        isConnected: true,
        focus() {
          active = this;
        },
        showModal() {
          this.open = true;
        },
        close() {
          this.open = false;
        },
        reportValidity: () => true,
        getBoundingClientRect: () => ({ left: 100, right: 400, top: 100, bottom: 400 }),
        set innerHTML(_value) {
          assert.fail("Notes must never be rendered as HTML");
        }
      });
    return fields.get(id);
  };
  const store = createStore({
    loadSyncedData: async () => raw,
    persistDataSynced: async (value) => {
      if (fail) throw new Error("Storage unavailable");
      raw = value;
      writes++;
    }
  });
  await store.reload();
  const editor = createNoteEditor({
    dom: {
      byId,
      on: (id, type, handler) => handlers.set(id + ":" + type, handler),
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
  const opener = byId("opener");
  opener.focus();
  return {
    byId,
    store,
    prompts,
    opener,
    open: () => editor.open(store.snapshot().state.habits[0], today),
    send: (id, type, event = {}) =>
      handlers.get(id + ":" + type)({ preventDefault() {}, ...event }),
    data: () => JSON.parse(raw),
    writes: () => writes,
    active: () => active,
    fail: () => {
      fail = true;
    },
    answer: () => {
      answer = true;
    },
    external: async (text) => {
      raw = D.encodeState(D.setNote(JSON.parse(raw), "reading", today, text, today));
      store.invalidate();
      await settle();
    },
    record: async () => {
      raw = D.encodeState(D.setCompletion(JSON.parse(raw), "reading", today, true, today));
      store.invalidate();
      await settle();
    }
  };
}

test("note editor saves plain text independently of an unknown check-in and restores focus", async () => {
  const h = await harness();
  h.open();
  h.byId("note-text").value = "<img src=x onerror=alert(1)>\n🌅";
  await h.send("note-form", "submit");
  assert.equal(h.data().habits[0].notes[today], "<img src=x onerror=alert(1)>\n🌅");
  assert.deepEqual(h.data().habits[0].counts, {});
  assert.equal(h.byId("note-editor").open, false);
  assert.equal(h.active(), h.opener);
  h.open();
  await h.send("remove-note", "click");
  assert.equal(h.data().habits[0].notes, undefined);
  assert.deepEqual(h.data().habits[0].counts, {});
});

test("failed note writes keep the confirmed note, draft text and visible error", async () => {
  const h = await harness("Confirmed note");
  h.open();
  h.fail();
  h.byId("note-text").value = "Unsaved draft";
  await h.send("note-form", "submit");
  assert.equal(h.data().habits[0].notes[today], "Confirmed note");
  assert.equal(h.byId("note-text").value, "Unsaved draft");
  assert.equal(h.byId("note-editor").open, true);
  assert.match(h.byId("note-error").textContent, /Storage unavailable/);
  assert.equal(h.writes(), 0);
});

test("an externally changed note cannot be overwritten by an older open draft", async () => {
  const h = await harness("Original");
  h.open();
  h.byId("note-text").value = "My draft";
  await h.external("Delivered note");
  await h.send("note-form", "submit");
  assert.equal(h.data().habits[0].notes[today], "Delivered note");
  assert.equal(h.byId("note-text").value, "My draft");
  assert.match(h.byId("note-error").textContent, /changed while the form was open/);
  assert.equal(h.store.snapshot().blocked, false);
});

test("a note draft can save after an unrelated completion delivery without changing that outcome", async () => {
  const h = await harness();
  h.open();
  h.byId("note-text").value = "My independent note";
  await h.record();
  await h.send("note-form", "submit");
  assert.equal(h.data().habits[0].counts[today], 1);
  assert.equal(h.data().habits[0].notes[today], "My independent note");
  assert.equal(h.byId("note-editor").open, false);
});

test("note cancellation protects unsaved text and does not write an outcome", async () => {
  const h = await harness();
  h.open();
  h.byId("note-text").value = "Unsaved note";
  await h.send("note-editor", "cancel");
  assert.equal(h.byId("note-editor").open, true);
  h.answer();
  await h.send("cancel-note", "click");
  assert.equal(h.byId("note-editor").open, false);
  assert.deepEqual(h.data().habits[0].counts, {});
  assert.equal(h.data().habits[0].notes, undefined);
  assert.equal(h.writes(), 0);
});
