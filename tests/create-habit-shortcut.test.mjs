import test from "node:test";
import assert from "node:assert/strict";
import {
  parseHostShortcut,
  matchesHostShortcut,
  mountCreateHabitShortcut
} from "../src/ui/create-habit-shortcut.js";

const target = (tag = "BODY", extra = {}) => ({
  tagName: tag,
  isContentEditable: false,
  closest: () => (["INPUT", "TEXTAREA", "SELECT"].includes(tag) ? {} : null),
  ...extra
});
const key = (code = "KeyA", extra = {}) => ({
  code,
  key: "A",
  shiftKey: true,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...extra
});

test("host combos preserve exact modifiers, case, layout mapping and literal plus semantics", () => {
  assert.equal(matchesHostShortcut(key(), parseHostShortcut("shift+a")), true);
  assert.equal(
    matchesHostShortcut(key("KeyA", { ctrlKey: true }), parseHostShortcut("Shift+A")),
    false
  );
  assert.equal(
    matchesHostShortcut(
      key("KeyN", { shiftKey: false, ctrlKey: true, altKey: true }),
      parseHostShortcut("Ctrl+Alt+N")
    ),
    true
  );
  assert.equal(
    matchesHostShortcut(key("Equal", { shiftKey: false }), parseHostShortcut("+")),
    true
  );
  assert.equal(
    matchesHostShortcut(
      key("Equal", { shiftKey: false, metaKey: true }),
      parseHostShortcut("Meta++")
    ),
    true
  );
  assert.equal(
    matchesHostShortcut(key("KeyA"), parseHostShortcut("Shift+É"), new Map([["KeyA", "é"]])),
    true
  );
  assert.equal(
    matchesHostShortcut(key("KeyA"), parseHostShortcut("Shift+A"), new Map([["KeyA", "é"]])),
    false
  );
  assert.equal(
    matchesHostShortcut(key("Digit3", { shiftKey: false }), parseHostShortcut("3")),
    true
  );
  for (const unsupported of [
    null,
    "",
    "Control+A",
    "Mod+N",
    "Ctrl+",
    "Ctrl+A|Alt+B",
    "Ctrl+Ctrl+A",
    "Enter",
    "Tab",
    "Space",
    "ArrowDown",
    "Ctrl+unknown-key"
  ])
    assert.equal(parseHostShortcut(unsupported), null, String(unsupported));
});

async function harness(combo = "Shift+A", keyboard) {
  const document = new EventTarget(),
    window = new EventTarget();
  let allowed = true,
    opened = 0,
    focused = true,
    modal = false,
    configured = combo;
  document.activeElement = target();
  document.hasFocus = () => focused;
  document.querySelector = () => (modal ? {} : null);
  window.document = document;
  window.navigator = { keyboard };
  const labels = [];
  const controller = mountCreateHabitShortcut({
    window,
    loadShortcut: async () => configured,
    canOpen: () => allowed,
    open: () => {
      opened++;
    },
    onChange: (label) => labels.push(label)
  });
  await controller.ready;
  return {
    controller,
    document,
    window,
    labels,
    opened: () => opened,
    allowed: (value) => {
      allowed = value;
    },
    focused: (value) => {
      focused = value;
    },
    modal: (value) => {
      modal = value;
    },
    configured: (value) => {
      configured = value;
    },
    send: (extra = {}, eventTarget = document.activeElement, receiver = document) => {
      const event = new Event("keydown", { cancelable: true });
      Object.assign(event, key(), extra);
      Object.defineProperty(event, "target", { value: eventTarget });
      event.composedPath = () => [eventTarget];
      let stopped = false;
      event.stopPropagation = () => {
        stopped = true;
      };
      receiver.dispatchEvent(event);
      return { prevented: event.defaultPrevented, stopped };
    }
  };
}

test("only a configured enabled action inside the focused iframe handles the host combo", async () => {
  const h = await harness();
  assert.deepEqual(h.send(), { prevented: true, stopped: true });
  assert.equal(h.opened(), 1);
  assert.deepEqual(h.send({ code: "KeyB", key: "B" }), { prevented: false, stopped: false });
  h.allowed(false);
  assert.equal(h.send().prevented, false);
  h.allowed(true);
  h.focused(false);
  assert.equal(h.send().prevented, false);
  h.focused(true);
  assert.equal(h.send({}, target(), h.window).prevented, false);
  assert.equal(h.opened(), 1);
});

test("typing, widgets, dialogs, repeats and composition never close or replace an existing edit", async () => {
  const h = await harness();
  for (const element of [
    target("INPUT"),
    target("TEXTAREA"),
    target("SELECT"),
    target("DIV", { isContentEditable: true }),
    target("DIV", { closest: () => ({ role: "textbox" }) })
  ])
    assert.equal(h.send({}, element).prevented, false);
  for (const override of [
    { repeat: true },
    { isComposing: true },
    { keyCode: 229 },
    { getModifierState: () => true }
  ])
    assert.equal(h.send(override).prevented, false);
  h.document.hidden = true;
  assert.equal(h.send().prevented, false);
  h.document.hidden = false;
  h.modal(true);
  assert.equal(h.send().prevented, false);
  h.modal(false);
  const event = new Event("keydown", { cancelable: true });
  Object.assign(event, key());
  event.preventDefault();
  h.document.dispatchEvent(event);
  assert.equal(h.opened(), 0);
});

test("customization, disabled bindings and lifecycle cleanup do not leave an old guessed shortcut", async () => {
  const h = await harness(null);
  assert.equal(h.send().prevented, false);
  h.configured("Ctrl+N");
  await h.controller.refresh();
  assert.equal(h.send().prevented, false);
  assert.equal(h.send({ code: "KeyN", shiftKey: false, ctrlKey: true }).prevented, true);
  assert.equal(h.controller.label(), "Ctrl+N");
  h.configured("");
  await h.controller.refresh();
  assert.equal(h.send({ code: "KeyN", shiftKey: false, ctrlKey: true }).prevented, false);
  h.configured("Shift+A");
  await h.controller.refresh();
  h.controller.dispose();
  assert.equal(h.send().prevented, false);
  assert.equal(h.opened(), 1);
});

test("a late configuration response cannot reinstall a shortcut after disposal", async () => {
  const document = new EventTarget(),
    window = new EventTarget();
  window.document = document;
  let resolve,
    changed = 0;
  const controller = mountCreateHabitShortcut({
    window,
    loadShortcut: () =>
      new Promise((done) => {
        resolve = done;
      }),
    canOpen: () => true,
    open: () => assert.fail("Disposed view"),
    onChange: () => {
      changed++;
    }
  });
  controller.dispose();
  resolve("Shift+A");
  await controller.ready;
  assert.equal(changed, 0);
});

test("the local Keyboard API map follows the host while unavailable layout data falls back safely", async () => {
  const h = await harness("Shift+É", { getLayoutMap: async () => new Map([["KeyA", "é"]]) });
  assert.equal(h.send().prevented, true);
  const fallback = await harness("Shift+A", {
    getLayoutMap: async () => {
      throw Error("Unavailable");
    }
  });
  assert.equal(fallback.send().prevented, true);
});
