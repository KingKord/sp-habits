import test from "node:test";
import assert from "node:assert/strict";
import { createThemePreference } from "../src/ui/theme-preference.js";

function harness(initial = null) {
  const data = new Map(initial ? [["habits-theme-v1", initial]] : []);
  const root = { dataset: {} };
  const body = { classList: { contains: () => dark } };
  const callbacks = [];
  let dark = false;
  let injected = "0";
  let unavailable = false;
  const media = new EventTarget();
  media.matches = true;
  const window = {
    document: { documentElement: root, getElementById: () => null },
    parent: { document: { body } },
    getComputedStyle: () => ({ getPropertyValue: () => injected }),
    matchMedia: () => media,
    localStorage: {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => {
        if (unavailable) throw Error("Storage unavailable");
        data.set(key, value);
      },
      removeItem: (key) => {
        if (unavailable) throw Error("Storage unavailable");
        data.delete(key);
      }
    },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
      }
      observe() {
        callbacks.push(this.callback);
      }
      disconnect() {
        callbacks.splice(callbacks.indexOf(this.callback), 1);
      }
    }
  };
  return {
    window,
    root,
    data,
    media,
    callbacks,
    setDark(value) {
      dark = value;
      for (const callback of [...callbacks]) callback();
    },
    setInjected(value) {
      injected = value;
    },
    failStorage() {
      unavailable = true;
    }
  };
}

test("explicit themes survive recreation; Follow app removes the override and tracks host changes", () => {
  const h = harness();
  const pref = createThemePreference(h.window);
  assert.equal(pref.value(), "auto");
  assert.equal(h.root.dataset.theme, "light", "host light wins over dark operating system");
  pref.set("dark");
  assert.equal(h.data.get("habits-theme-v1"), "dark");
  h.setDark(false);
  assert.equal(h.root.dataset.theme, "dark");
  pref.dispose();
  const reopened = createThemePreference(h.window);
  assert.equal(reopened.value(), "dark");
  reopened.set("auto");
  assert.equal(h.data.has("habits-theme-v1"), false);
  assert.equal(h.root.dataset.theme, "light");
  h.setDark(true);
  assert.equal(h.root.dataset.theme, "dark");
  reopened.dispose();
  assert.equal(h.callbacks.length, 0);
});

test("storage failure applies the current-view choice and reports its persistence limit", () => {
  const h = harness("unexpected");
  let warnings = 0;
  const pref = createThemePreference(h.window, () => warnings++);
  h.failStorage();
  pref.set("dark");
  assert.equal(pref.value(), "dark");
  assert.equal(h.root.dataset.theme, "dark");
  assert.equal(warnings, 1);
  assert.equal(h.data.get("habits-theme-v1"), "unexpected");
  pref.dispose();
});

test("opaque hosts use their injected flag or the system preference without throwing", () => {
  const h = harness();
  Object.defineProperty(h.window, "parent", {
    get: () => {
      throw Error("Opaque origin");
    }
  });
  const pref = createThemePreference(h.window);
  assert.equal(h.root.dataset.theme, "light");
  h.setInjected("1");
  h.media.dispatchEvent(new Event("change"));
  assert.equal(h.root.dataset.theme, "dark");
  h.setInjected("");
  h.media.matches = false;
  h.media.dispatchEvent(new Event("change"));
  assert.equal(h.root.dataset.theme, "light");
  pref.dispose();
});
