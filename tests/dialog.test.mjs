import test from "node:test";
import assert from "node:assert/strict";
import { closeOnBackdrop } from "../src/ui/dialog.js";

function harness() {
  let closed = 0;
  const handlers = {};
  const dialog = {
    getBoundingClientRect: () => ({ left: 100, right: 400, top: 100, bottom: 400 })
  };
  closeOnBackdrop(
    {
      byId: () => dialog,
      on: (_id, event, handler) => {
        handlers[event] = handler;
      }
    },
    "dialog",
    () => {
      closed++;
    }
  );
  return {
    send: (type, x, y, target = dialog) => handlers[type]({ target, clientX: x, clientY: y }),
    get closed() {
      return closed;
    }
  };
}
test("only backdrop presses dismiss a dialog, not fields, padding or keyboard-generated clicks", () => {
  const h = harness();
  h.send("click", 0, 0);
  h.send("pointerdown", 200, 200, {});
  h.send("click", 200, 200, {});
  h.send("pointerdown", 110, 110);
  h.send("click", 110, 110);
  assert.equal(h.closed, 0);
  h.send("pointerdown", 30, 30);
  h.send("click", 30, 30);
  assert.equal(h.closed, 1);
});
test("dragging or cancelled pointer gestures do not discard dialog edits", () => {
  const h = harness();
  h.send("pointerdown", 200, 200, {});
  h.send("click", 30, 30);
  h.send("pointerdown", 30, 30);
  h.send("click", 200, 200);
  h.send("pointerdown", 30, 30);
  h.send("pointercancel", 30, 30);
  h.send("click", 30, 30);
  assert.equal(h.closed, 0);
  h.send("pointerdown", 30, 30);
  h.send("click", 30, 30);
  assert.equal(h.closed, 1);
});
