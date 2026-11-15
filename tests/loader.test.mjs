import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { bundle } from "../scripts/bundle.mjs";
import { MAX_APPLICATION_CHARACTERS } from "../src/host/protocol.js";

const loader = await bundle("src/loader.js");
const host = await bundle("src/plugin.js");
const key = Symbol.for("habits.applicationLoader");

function harness(origin = "https://app.test") {
  const listeners = new Map(),
    timers = new Map(),
    requests = [],
    scripts = [],
    errors = [];
  let sequence = 0,
    unload,
    ready;
  const parent = { postMessage: (data, targetOrigin) => requests.push({ data, targetOrigin }) };
  const document = {
    body: {
      hidden: true,
      replaceChildren: (...children) => {
        document.body.children = children;
      }
    },
    createElement: (tag) => ({ tag, textContent: "" }),
    head: {
      append: (script) => {
        scripts.push(script);
        try {
          vm.runInContext(script.textContent, context);
        } catch (error) {
          errors.push(error);
        }
      }
    }
  };
  const window = {
    parent,
    document,
    origin,
    location: { origin },
    PluginAPI: {
      onUnload: (callback) => {
        unload = callback;
      },
      onReady: (callback) => {
        ready = callback;
      }
    },
    crypto: { randomUUID: () => "request-" + ++sequence },
    setTimeout: (callback) => {
      const id = ++sequence;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    addEventListener: (type, callback) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener: (type, callback) => listeners.get(type)?.delete(callback)
  };
  const context = vm.createContext({ window, Symbol, Intl, JSON, structuredClone });
  const run = () => vm.runInContext(loader, context);
  run();
  const receive = (data, source = parent, eventOrigin = origin) => {
    for (const callback of listeners.get("message") ?? [])
      callback({ data, source, origin: eventOrigin });
  };
  return {
    window,
    document,
    requests,
    scripts,
    timers,
    errors,
    listeners,
    run,
    receive,
    controller: window[key],
    reply: (source, extra = {}) =>
      receive({
        type: "PLUGIN_MESSAGE_RESPONSE",
        messageId: requests[0].data.messageId,
        result: { ok: true, source, ...extra }
      }),
    hide: () => {
      for (const callback of [...(listeners.get("pagehide") ?? [])]) callback();
    },
    unload: () => unload(),
    get ready() {
      return ready;
    }
  };
}

const response = (request, source) => ({
  type: "PLUGIN_MESSAGE_RESPONSE",
  messageId: request.messageId,
  result: { ok: true, source }
});

test("shipped loader executes once after a correlated public response from its parent origin", async () => {
  const h = harness(),
    request = h.requests[0].data;
  assert.equal(request.type, "PLUGIN_MESSAGE");
  assert.equal(request.message.asset, "application");
  assert.equal(h.document.body.hidden, true);
  const reply = response(request, "window.started = (window.started || 0) + 1;");
  h.receive(reply, {});
  h.receive(reply, h.window.parent, "https://hostile.test");
  h.receive({ ...reply, messageId: "unknown" });
  h.receive({ ...reply, type: "HABITS_EXPORT_RESPONSE" });
  await Promise.resolve();
  assert.equal(h.window.started, undefined);
  assert.equal(h.scripts.length, 0);
  h.receive(reply);
  assert.equal(await h.controller.ready, true);
  assert.equal(h.window.started, 1);
  h.run();
  assert.equal(h.requests.length, 1);
  assert.equal(h.scripts.length, 1);
  assert.equal(h.timers.size, 0);
  assert.equal(h.listeners.get("message").size, 0);
  assert.equal(h.listeners.get("pagehide").size, 0);
});

test("missing, oversized and syntactically malformed application resources fail visibly", async () => {
  for (const source of [
    undefined,
    null,
    {},
    "",
    "   ",
    "(",
    "window.started = ;",
    "x".repeat(MAX_APPLICATION_CHARACTERS + 1)
  ]) {
    const h = harness();
    h.reply(source);
    assert.equal(await h.controller.ready, false);
    assert.equal(h.document.body.hidden, false);
    assert.match(h.document.body.children[0].textContent, /Reopen Habit Ledger to retry/);
    assert.equal(h.window.started, undefined);
    assert.equal(h.timers.size, 0);
  }
  const h = harness();
  h.reply(undefined, { ok: false, error: "Unavailable" });
  assert.equal(await h.controller.ready, false);
});

test("pagehide, unload and timeout dispose pending resources without resurrecting the view", async () => {
  for (const operation of ["hide", "unload", "timeout"]) {
    const h = harness();
    if (operation === "timeout") [...h.timers.values()][0]();
    else h[operation]();
    assert.equal(await h.controller.ready, false);
    h.reply("window.started = true;");
    assert.equal(h.window.started, undefined);
    assert.equal(h.document.body.hidden, operation !== "timeout");
    assert.equal(h.timers.size, 0);
    assert.equal(h.listeners.get("message").size, 0);
  }
});

test("shipped public host handler serves application code without a document or history access", async () => {
  const h = harness();
  let handler,
    reads = 0,
    writes = 0;
  const api = {
    onMessage: (fn) => {
      handler = fn;
    },
    onUnload: () => {},
    loadSyncedData: async () => {
      reads++;
      throw Error("Unexpected read");
    },
    persistDataSynced: async () => {
      writes++;
      throw Error("Unexpected write");
    }
  };
  vm.runInNewContext(host, { PluginAPI: api, Intl, JSON, structuredClone });
  const request = h.requests[0].data;
  const result = await handler(request.message);
  h.receive({ type: "PLUGIN_MESSAGE_RESPONSE", messageId: request.messageId, result });
  assert.equal(await h.controller.ready, true);
  assert.doesNotThrow(() => new vm.Script(result.source));
  assert.equal(typeof h.ready, "function");
  assert.equal(h.document.body.hidden, true);
  assert.equal(reads, 0);
  assert.equal(writes, 0);
  h.hide();
});

test("loader retains opaque Electron origin validation", async () => {
  const h = harness("file://");
  assert.equal(h.requests[0].targetOrigin, "*");
  const reply = response(h.requests[0].data, "window.started = true;");
  h.receive(reply, h.window.parent, "https://hostile.test");
  assert.equal(h.scripts.length, 0);
  h.receive(reply, h.window.parent, "null");
  assert.equal(await h.controller.ready, true);
  assert.equal(h.window.started, true);
});
