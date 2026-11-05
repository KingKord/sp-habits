import test from "node:test";
import assert from "node:assert/strict";
import { createExportClient } from "../src/host/export-client.js";
import { installExportBridge } from "../src/host/export-host.js";
import {
  EXPORT_REQUEST,
  EXPORT_RESPONSE,
  SYSTEM_EMOJI_REQUEST,
  SYSTEM_EMOJI_RESPONSE
} from "../src/host/protocol.js";

function harness(origin = "https://app.test") {
  let sequence = 0,
    handler;
  const sent = [],
    timers = new Map();
  const parent = { postMessage: (data, targetOrigin) => sent.push({ data, targetOrigin }) };
  const window = {
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

test("export client correlates concurrent responses and rejects untrusted senders and origins", async () => {
  const h = harness();
  const first = h.client.request(),
    second = h.client.request(true);
  const [a, b] = h.sent.map((item) => item.data);
  assert.equal(a.type, EXPORT_REQUEST);
  assert.equal(b.recovery, true);
  assert.equal(h.sent[0].targetOrigin, "https://app.test");
  const response = { type: EXPORT_RESPONSE, requestId: a.requestId, ok: true, filename: "a.json" };
  h.receive(response, {});
  h.receive(response, h.window.parent, "https://other.test");
  h.receive({ ...response, requestId: "unknown" });
  assert.equal(h.timers.size, 2);
  h.receive({ ...response, requestId: b.requestId, filename: "b.json" });
  assert.equal((await second).filename, "b.json");
  h.receive(response);
  assert.equal((await first).filename, "a.json");
  assert.equal(h.timers.size, 0);
  h.client.dispose();
});

test("export timeout and synchronous transport failure release pending requests", async () => {
  const h = harness();
  const timedOut = h.client.request();
  const rejected = assert.rejects(timedOut, /did not respond/);
  [...h.timers.values()][0]();
  await rejected;
  assert.equal(h.timers.size, 0);
  h.window.parent.postMessage = () => {
    throw new Error("Disconnected");
  };
  await assert.rejects(h.client.request(), /Disconnected/);
  assert.equal(h.timers.size, 0);
  h.client.dispose();
});
test("system emoji requests have their own response channel and cannot become export requests", async () => {
  const h = harness();
  const result = h.client.systemEmoji(true);
  const request = h.sent[0].data;
  assert.equal(request.type, SYSTEM_EMOJI_REQUEST);
  assert.equal(request.open, true);
  h.receive({ type: EXPORT_RESPONSE, requestId: request.requestId, ok: true });
  assert.equal(h.timers.size, 1);
  h.receive({
    type: SYSTEM_EMOJI_RESPONSE,
    requestId: request.requestId,
    ok: true,
    available: true
  });
  assert.equal((await result).available, true);
  assert.equal(h.timers.size, 0);
  h.client.dispose();
});

test("srcdoc uses its inherited window origin instead of the null URL origin", async () => {
  const h = harness();
  h.window.origin = "https://app.test";
  h.window.location.origin = "null";
  h.client.dispose();
  const client = createExportClient(h.window);
  const request = client.request();
  assert.equal(h.sent[0].targetOrigin, "https://app.test");
  h.receive({ type: EXPORT_RESPONSE, requestId: h.sent[0].data.requestId, ok: true });
  assert.equal((await request).ok, true);
  client.dispose();
});
test("Electron file origins accept opaque replies from the parent and use wildcard delivery", async () => {
  const h = harness("file://");
  const result = h.client.systemEmoji();
  const request = h.sent[0].data;
  assert.equal(h.sent[0].targetOrigin, "*");
  h.receive(
    { type: SYSTEM_EMOJI_RESPONSE, requestId: request.requestId, ok: true, available: true },
    h.window.parent,
    "https://other.test"
  );
  assert.equal(h.timers.size, 1);
  h.receive(
    { type: SYSTEM_EMOJI_RESPONSE, requestId: request.requestId, ok: true, available: true },
    h.window.parent,
    "null"
  );
  assert.equal((await result).available, true);
  h.client.dispose();
});

test("export disposal rejects all waiting requests and removes its listener", async () => {
  const h = harness();
  const requests = [h.client.request(), h.client.request()];
  const rejected = requests.map((request) => assert.rejects(request, /closed/));
  h.client.dispose();
  h.client.dispose();
  await Promise.all(rejected);
  assert.equal(h.timers.size, 0);
  assert.equal(h.listening, false);
  await assert.rejects(h.client.request(), /closed/);
});

test("client and host bridge exchange a backup through the shared protocol", async () => {
  const h = harness("null");
  let hostListener, saved;
  const frame = { postMessage: (data) => h.receive(data) };
  const hostWindow = {
    location: { origin: "null" },
    addEventListener: (_type, fn) => {
      hostListener = fn;
    },
    removeEventListener: () => {
      hostListener = undefined;
    }
  };
  const removeHost = installExportBridge(
    {
      loadSyncedData: async () => '{"habits":[]}',
      downloadFile: async (filename, data) => {
        saved = { filename, data };
      }
    },
    hostWindow,
    {
      querySelectorAll: () => [{ contentWindow: frame, contentDocument: { title: "Habits" } }]
    }
  );
  h.window.parent.postMessage = (data) => {
    void hostListener({ data, source: frame, origin: "null" });
  };
  const result = await h.client.request();
  assert.equal(result.filename, "habits-backup.json");
  assert.deepEqual(JSON.parse(saved.data), { habits: [] });
  assert.equal(h.timers.size, 0);
  removeHost();
  assert.equal(hostListener, undefined);
  h.client.dispose();
});
