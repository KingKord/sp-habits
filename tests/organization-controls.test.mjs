import test from "node:test";
import assert from "node:assert/strict";
import { createOrganizationControls } from "../src/ui/organization-controls.js";
import { createStore } from "../src/store.js";
import { createGroup, renameGroup, removeGroup } from "../src/organization.js";
import * as D from "../src/domain.js";

const today = "2026-11-12";
const settle = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
async function harness() {
  let seed = D.createHabit(
    D.emptyState("UTC"),
    { name: "Reading", limit: 1, initialCount: 0, startDate: today },
    today,
    "reading"
  );
  seed = createGroup(createGroup(seed, "routine", "Morning"), "other", "Learning");
  let raw = D.encodeState(seed),
    writes = 0,
    fail = false;
  const elements = new Map();
  function node(tag, text) {
    return {
      tag,
      text,
      value: "",
      hidden: false,
      children: [],
      handlers: {},
      dataset: {},
      append(...items) {
        for (const item of items)
          this.children.push(...(item.tag === "fragment" ? item.children : [item]));
      },
      replaceChildren(...items) {
        this.children = [];
        this.append(...items);
      },
      addEventListener(type, action) {
        this.handlers[type] = action;
      },
      setAttribute() {},
      reportValidity: () => true
    };
  }
  const byId = (id) => {
    if (!elements.has(id)) elements.set(id, node("div"));
    return elements.get(id);
  };
  const render = () => {
    const snapshot = store.snapshot();
    if (snapshot.state)
      controls.management(
        snapshot.state,
        snapshot.blocked || snapshot.busyRead || snapshot.pending > 0,
        true
      );
  };
  const store = createStore(
    {
      loadSyncedData: async () => raw,
      persistDataSynced: async (value) => {
        if (fail) throw new Error("Storage unavailable");
        raw = value;
        writes++;
      }
    },
    render
  );
  const controls = createOrganizationControls({
    dom: {
      node,
      byId,
      fragment: () => node("fragment"),
      restoreFocus: () => {},
      button: (text, action) => {
        const element = node("button", text);
        element.handlers.click = action;
        return element;
      }
    },
    commit: async (transform) => {
      try {
        await store.mutate(transform);
        return true;
      } catch {
        return false;
      }
    },
    render,
    confirm: () => true,
    newId: () => "new-group"
  });
  await store.reload();
  const row = (id) =>
    byId("group-manager").children.find((row) =>
      row.children.some((field) => field.dataset.focusKey === "group-name-" + id)
    );
  const field = (id) => row(id)?.children.find((field) => field.tag === "input");
  return {
    store,
    byId,
    row,
    field,
    type(id, value) {
      const input = field(id);
      input.value = value;
      input.handlers.input();
    },
    rename: (id) => row(id).handlers.submit({ preventDefault() {} }),
    cancel: (id) =>
      row(id)
        .children.find((el) => el.text === "Cancel rename")
        .handlers.click(),
    data: () => JSON.parse(raw),
    writes: () => writes,
    external: async (transform) => {
      raw = D.encodeState(transform(JSON.parse(raw)));
      store.invalidate();
      await settle();
    },
    fail: () => {
      fail = true;
    },
    recover: async () => {
      fail = false;
      await store.reload();
    }
  };
}

test("inline group rename persists normally after unrelated habit and group deliveries", async () => {
  const h = await harness();
  h.type("routine", "Early routine");
  await h.external((state) =>
    D.changeCount(renameGroup(state, "other", "Professional learning"), "reading", today, 1, today)
  );
  assert.equal(h.field("routine").value, "Early routine");
  await h.rename("routine");
  assert.equal(h.data().groups.find((group) => group.id === "routine").name, "Early routine");
  assert.equal(h.data().groups.find((group) => group.id === "other").name, "Professional learning");
  assert.equal(h.data().habits[0].counts[today], 1);
  assert.equal(h.writes(), 1);
  assert.equal(h.row("routine").children.find((el) => el.text === "Cancel rename").hidden, true);
});

test("an inline draft retains its original baseline and cannot overwrite a delivered group rename", async () => {
  const h = await harness();
  h.type("routine", "My draft");
  await h.external((state) => renameGroup(state, "routine", "Delivered name"));
  assert.equal(h.field("routine").value, "My draft");
  await h.rename("routine");
  assert.equal(h.data().groups[0].name, "Delivered name");
  assert.equal(h.field("routine").value, "My draft");
  assert.equal(h.store.snapshot().blocked, false);
  assert.match(h.byId("group-error").textContent, /This group changed/);
  assert.equal(h.writes(), 0);
  h.cancel("routine");
  assert.equal(h.field("routine").value, "Delivered name");
  h.type("routine", "Reviewed name");
  await h.rename("routine");
  assert.equal(h.data().groups[0].name, "Reviewed name");
});

test("a deleted group keeps its inline draft reviewable without recreating the group", async () => {
  const h = await harness();
  h.type("routine", "My retained draft");
  await h.external((state) => removeGroup(state, "routine"));
  assert.equal(h.field("routine").value, "My retained draft");
  assert.ok(h.row("routine").children.some((el) => el.text === "This group no longer exists."));
  await h.rename("routine");
  assert.equal(h.store.snapshot().blocked, false);
  assert.equal(
    h.data().groups.some((group) => group.id === "routine"),
    false
  );
  assert.equal(h.field("routine").value, "My retained draft");
  assert.equal(h.writes(), 0);
  h.cancel("routine");
  assert.equal(h.row("routine"), undefined);
});

test("failed inline rename persistence retains confirmed data and the draft through recovery", async () => {
  const h = await harness();
  h.type("routine", "Unsaved name");
  h.fail();
  await h.rename("routine");
  assert.equal(h.data().groups[0].name, "Morning");
  assert.equal(h.field("routine").value, "Unsaved name");
  assert.match(h.store.snapshot().error, /Storage unavailable/);
  assert.equal(h.store.snapshot().blocked, true);
  assert.equal(h.writes(), 0);
  await h.recover();
  assert.equal(h.field("routine").value, "Unsaved name");
  await h.rename("routine");
  assert.equal(h.data().groups[0].name, "Unsaved name");
  assert.equal(h.writes(), 1);
});

test("unrelated persistence refresh retains the exact group input and its selection", async () => {
  const h = await harness();
  h.type("routine", "Edited group draft");
  const field = h.field("routine");
  field.selectionStart = 1;
  field.selectionEnd = 6;
  field.scrollLeft = 12;
  await h.external((state) => D.changeCount(state, "reading", today, 1, today));
  assert.equal(h.field("routine"), field);
  assert.equal(field.selectionStart, 1);
  assert.equal(field.selectionEnd, 6);
  assert.equal(field.scrollLeft, 12);
  assert.equal(field.value, "Edited group draft");
});

test("group composition keeps its connected draft through a delivered update", async () => {
  const h = await harness();
  const field = h.field("routine");
  field.handlers.compositionstart();
  field.value = "Composing group";
  await h.external((state) => D.changeCount(state, "reading", today, 1, today));
  assert.equal(h.field("routine"), field);
  assert.equal(field.disabled, false);
  assert.equal(field.value, "Composing group");
  field.handlers.compositionend();
  await h.rename("routine");
  assert.equal(h.data().groups[0].name, "Composing group");
});

test("emoji group edits stay explicitly unsaved until confirmation and preserve spaces and sequences", async () => {
  const h = await harness();
  const status = () =>
    h.row("routine").children.find((el) => el.id === "group-name-status-routine");
  assert.equal(status().hidden, true);
  assert.ok(h.row("routine").children.some((el) => el.text === "Save name"));
  for (const name of ["Meals🍽️", "Meals 🍽️", "Family 👩‍👩‍👧‍👦"]) {
    const original = h.data().groups[0].name;
    h.type("routine", name);
    assert.equal(status().hidden, false);
    assert.match(status().text, /Unsaved name.*Enter.*Save name/);
    assert.equal(h.data().groups[0].name, original);
    await h.rename("routine");
    assert.equal(status().hidden, true);
    assert.equal(h.data().groups[0].name, name);
    await h.store.reload();
    assert.equal(h.field("routine").value, name);
    assert.equal(D.parseBackup(D.encodeState(h.data())).groups[0].name, name);
  }
  h.type("routine", "Cancelled 🧑🏽‍💻");
  assert.equal(status().hidden, false);
  h.cancel("routine");
  assert.equal(status().hidden, true);
  assert.equal(h.field("routine").value, "Family 👩‍👩‍👧‍👦");
});
