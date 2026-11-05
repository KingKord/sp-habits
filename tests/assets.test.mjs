import test from "node:test";
import assert from "node:assert/strict";
import { prepareLocalization } from "../src/i18n/setup.js";
import { setLanguage } from "../src/i18n/index.js";
import messages from "../src/i18n/en.json" with { type: "json" };

function harness(styles) {
  const events = new Map(),
    nodes = [];
  const document = {
    body: { hidden: true },
    documentElement: { lang: "" },
    createTreeWalker: () => ({ nextNode: () => null }),
    querySelectorAll: () => [],
    createElement: (tag) => ({ tag, textContent: "" }),
    head: {
      append: (node) => {
        assert.equal(document.body.hidden, true);
        nodes.push(node);
      }
    }
  };
  const parent = {
    postMessage: (request) =>
      queueMicrotask(() => {
        for (const fn of events.get("message") ?? [])
          fn({
            source: parent,
            origin: "https://app.test",
            data: {
              type: "HABITS_EXPORT_RESPONSE",
              requestId: request.requestId,
              ok: true,
              messages,
              styles
            }
          });
      })
  };
  const window = {
    document,
    parent,
    origin: "https://app.test",
    crypto: { randomUUID: () => "assets" },
    setTimeout,
    clearTimeout,
    PluginAPI: { getCurrentLanguage: async () => "en" },
    addEventListener: (name, fn) => {
      if (!events.has(name)) events.set(name, new Set());
      events.get(name).add(fn);
    },
    removeEventListener: (name, fn) => events.get(name)?.delete(fn)
  };
  return { window, document, nodes, events };
}
test("trusted styles are inserted as text before revealing the localized app and the temporary client is disposed", async () => {
  const css = ".habit-progress { color: red; } /* </style><script>not executable</script> */";
  const h = harness(css);
  try {
    await prepareLocalization(h.window);
    assert.deepEqual(h.nodes, [{ tag: "style", textContent: css }]);
    assert.equal(h.document.documentElement.lang, "en");
    assert.equal(h.document.body.hidden, true);
    assert.equal(h.events.get("message").size, 0);
    assert.equal(h.events.get("pagehide").size, 0);
  } finally {
    setLanguage("ru");
  }
});
test("missing or malformed style assets fail closed without showing an unstyled app", async () => {
  for (const styles of [undefined, null, "", "   ", {}]) {
    const h = harness(styles);
    await assert.rejects(prepareLocalization(h.window), /Missing plugin styles/);
    assert.deepEqual(h.nodes, []);
    assert.equal(h.document.body.hidden, true);
    assert.equal(h.events.get("message").size, 0);
    assert.equal(h.events.get("pagehide").size, 0);
  }
});
