import test from "node:test";
import assert from "node:assert/strict";
import { createDOM } from "../src/ui/dom.js";
import { createScope } from "../src/ui/scope.js";

function harness() {
  const document = new EventTarget();
  document.activeElement = null;
  document.elements = [];
  document.querySelectorAll = () => document.elements;
  const scope = createScope();
  const dom = createDOM(document, scope);
  function button(key, disabled = false) {
    return {
      dataset: { focusKey: key },
      disabled,
      focus() {
        if (!this.disabled) document.activeElement = this;
      }
    };
  }
  return { document, scope, dom, button };
}

test("focus returns to the replacement opener after a temporary storage refresh disables it", () => {
  const { document, dom, button, scope } = harness();
  document.elements = [button("cal-detail-reading-2026-11-02", true)];
  dom.restoreFocus("cal-detail-reading-2026-11-02");
  assert.equal(document.activeElement, null);
  const replacement = button("cal-detail-reading-2026-11-02");
  document.elements = [replacement];
  dom.restoreFocus();
  assert.equal(document.activeElement, replacement);
  // An unrelated render has no outstanding request to steal focus.
  document.activeElement = null;
  dom.restoreFocus();
  assert.equal(document.activeElement, null);
  scope.dispose();
});

test("user input, removal of the opener and disposal cancel a delayed focus request", () => {
  for (const action of ["pointerdown", "keydown", "removed", "dispose"]) {
    const { document, dom, button, scope } = harness();
    document.elements = [button("reading-count", true)];
    dom.restoreFocus("reading-count");
    if (action === "dispose") scope.dispose();
    else if (action === "removed") {
      document.elements = [];
      dom.restoreFocus();
    } else document.dispatchEvent(new Event(action));
    document.elements = [button("reading-count")];
    dom.restoreFocus();
    assert.equal(document.activeElement, null, action);
    scope.dispose();
  }
});
