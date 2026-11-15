import test from "node:test";
import assert from "node:assert/strict";
import { createExportClient } from "../src/host/export-client.js";
import { installExportBridge } from "../src/host/export-host.js";
import {
  EXPORT_REQUEST,
  EXPORT_RESPONSE,
  MESSAGE_REQUEST,
  MESSAGE_ERROR
} from "../src/host/protocol.js";
function harness(origin = "https://app.test") {
  let sequence = 0,
    handler;
  const sent = [],
    timers = new Map();
  const parent = { postMessage: (data, targetOrigin) => sent.push({ data, targetOrigin }) };
  const hooks = new Map(),
    intervals = new Map();
  const window = {
    PluginAPI: {
      registerHook: (name, fn) => {
        hooks.set(name, fn);
      }
    },
    setInterval: (fn) => {
      const id = ++sequence;
      intervals.set(id, fn);
      return id;
    },
    clearInterval: (id) => intervals.delete(id),
    parent,
    location: { origin },
    crypto: { randomUUID: () => String(++sequence) },
    addEventListener: (_type, fn) => {
      handler = fn;
    },
    removeEventListener: (_type, fn) => {
      if (handler === fn) handler = undefined;
    },
    setTimeout: (fn) => {
      const id = ++sequence;
      timers.set(id, fn);
      return id;
    },
    clearTimeout: (id) => timers.delete(id)
  };
  const client = createExportClient(window);
  return {
    client,
    hooks,
    intervals,
    window,
    sent,
    timers,
    receive: (data, sender = parent, senderOrigin = origin) =>
      handler?.({ data, source: sender, origin: senderOrigin }),
    get listening() {
      return !!handler;
    }
  };
}

const reply = (request, result = { ok: true }) => ({
  type: EXPORT_RESPONSE,
  messageId: request.messageId,
  result
});

test("public message client correlates nested responses and rejects untrusted senders and origins", async () => {
  const h = harness();
  const first = h.client.request(),
    second = h.client.request(true);
  const [a, b] = h.sent.map((item) => item.data);
  assert.equal(a.type, MESSAGE_REQUEST);
  assert.equal(a.message.type, EXPORT_REQUEST);
  assert.equal(b.message.recovery, true);
  assert.equal(h.sent[0].targetOrigin, "https://app.test");
  const response = reply(a, { ok: true, filename: "a.json" });
  h.receive(response, {});
  h.receive(response, h.window.parent, "https://other.test");
  h.receive({ ...response, messageId: "unknown" });
  h.receive({ ...response, type: "HABITS_EXPORT_RESPONSE" });
  assert.equal(h.timers.size, 2);
  h.receive(reply(b, { ok: true, filename: "b.json" }));
  assert.equal((await second).filename, "b.json");
  h.receive(response);
  assert.equal((await first).filename, "a.json");
  assert.equal(h.timers.size, 0);
  h.client.dispose();
});

test("transport errors, handler failures, timeouts and synchronous failures release requests", async () => {
  const h = harness();
  let result = h.client.request();
  h.receive({
    type: MESSAGE_ERROR,
    messageId: h.sent.at(-1).data.messageId,
    error: "Host handler unavailable"
  });
  await assert.rejects(result, /unavailable/);
  result = h.client.request();
  h.receive(reply(h.sent.at(-1).data, { ok: false, error: "Disk failed" }));
  await assert.rejects(result, /Disk/);
  const timedOut = assert.rejects(h.client.request(), /did not respond/);
  [...h.timers.values()][0]();
  await timedOut;
  h.window.parent.postMessage = () => {
    throw Error("Disconnected");
  };
  await assert.rejects(h.client.request(), /Disconnected/);
  assert.equal(h.timers.size, 0);
  h.client.dispose();
});

test("srcdoc inherited origins and opaque Electron origins remain source checked", async () => {
  for (const origin of ["https://app.test", "file://"]) {
    const h = harness(origin);
    h.client.dispose();
    h.window.origin = origin;
    h.window.location.origin = "null";
    const client = createExportClient(h.window);
    const result = client.request();
    const request = h.sent.at(-1);
    assert.equal(request.targetOrigin, origin === "file://" ? "*" : origin);
    h.receive(reply(request.data), h.window.parent, "https://other.test");
    assert.equal(h.timers.size, 1);
    h.receive(reply(request.data), h.window.parent, origin === "file://" ? "null" : origin);
    assert.equal((await result).ok, true);
    client.dispose();
  }
});

test("bounded revision checks invalidate views without registering persistent iframe hooks", async () => {
  const h = harness();
  let changed = 0;
  const unsubscribe = h.client.subscribe(() => {
    changed++;
  });
  assert.equal(h.hooks.size, 0);
  const tick = [...h.intervals.values()][0];
  assert.equal(h.sent.at(-1).data.message.asset, "status");
  const finish = async (value) => {
    h.receive(reply(h.sent.at(-1).data, { ok: true, revision: value }));
    await Promise.resolve();
  };
  await finish(3);
  assert.equal(changed, 1);
  let pending = tick();
  await finish(3);
  await pending;
  assert.equal(changed, 1);
  pending = tick();
  await finish(4);
  await pending;
  assert.equal(changed, 2);
  unsubscribe();
  assert.equal(h.intervals.size, 0);
  const before = h.sent.length;
  await tick();
  assert.equal(h.sent.length, before);
  h.client.dispose();
  h.client.subscribe(() => {
    changed++;
  });
  assert.equal(h.intervals.size, 0);
  assert.equal(changed, 2);
});

test("reopening and disposing views does not accumulate host hooks or polling timers", async () => {
  const h = harness();
  h.client.dispose();
  for (let index = 0; index < 12; index++) {
    const client = createExportClient(h.window);
    client.subscribe(() => assert.fail("A closed view must not receive updates"));
    assert.equal(h.intervals.size, 1);
    const request = h.sent.at(-1).data;
    client.dispose();
    h.receive(reply(request, { ok: true, revision: index }));
    await Promise.resolve();
    assert.equal(h.intervals.size, 0);
    assert.equal(h.timers.size, 0);
    assert.equal(h.hooks.size, 0);
  }
});

test("disposal rejects pending requests and ignores late host responses", async () => {
  const h = harness();
  const pending = h.client.request();
  const rejected = assert.rejects(pending, /closed/);
  const request = h.sent[0].data;
  h.client.dispose();
  h.client.dispose();
  await rejected;
  h.receive(reply(request));
  assert.equal(h.timers.size, 0);
  assert.equal(h.listening, false);
  await assert.rejects(h.client.request(), /closed/);
});

test("client and public host handler exchange backups without host DOM access", async () => {
  const h = harness("null");
  let handler, saved;
  const stop = installExportBridge({
    onMessage: (fn) => {
      handler = fn;
    },
    loadSyncedData: async () => '{"habits":[]}',
    downloadFile: async (filename, data) => {
      saved = { filename, data };
    }
  });
  h.window.parent.postMessage = async (request) =>
    h.receive(reply(request, await handler(request.message)));
  assert.equal((await h.client.request()).filename, "habits-backup.json");
  assert.deepEqual(JSON.parse(saved.data), { habits: [] });
  stop();
  await assert.rejects(h.client.request(), /closed/);
  h.client.dispose();
});
