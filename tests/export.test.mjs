import russian from "../src/i18n/ru.json" with { type: "json" };
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { bundle } from "../scripts/bundle.mjs";
// Exercise the same standalone script that is shipped to the host in the ZIP.
const script = await bundle("src/plugin.js");
function harness(raw) {
  let handler,
    unload,
    removed = false,
    saved,
    response;
  const source = {
    postMessage: (data) => {
      response = data;
    }
  };
  const window = {
    location: { origin: "https://app.test" },
    addEventListener: (name, fn) => {
      handler = fn;
    },
    removeEventListener: (name, fn) => {
      removed = fn === handler;
    }
  };
  const api = {
    loadSyncedData: async () => raw,
    downloadFile: async (name, data) => {
      saved = { name, data };
    },
    onUnload: (fn) => {
      unload = fn;
    }
  };
  const document = {
    querySelectorAll: () => [{ contentWindow: source, contentDocument: { title: "Habits" } }]
  };
  vm.runInNewContext(script, { window, document, PluginAPI: api, Intl, JSON });
  return {
    window,
    source,
    api,
    unload: () => unload(),
    get removed() {
      return removed;
    },
    get saved() {
      return saved;
    },
    get response() {
      return response;
    },
    dispatch: (data, origin = window.location.origin, sender = source) =>
      handler({ data, origin, source: sender })
  };
}
test("export uses the host download API and preserves malformed data for recovery", async () => {
  const h = harness("{broken");
  await h.dispatch({ type: "HABITS_EXPORT_REQUEST", requestId: "1", recovery: true });
  assert.equal(h.saved.name, "habits-recovery.json");
  assert.equal(h.saved.data, "{broken");
  assert.equal(h.response.ok, true);
  h.unload();
  assert.equal(h.removed, true);
});
test("export accepts only its own iframe and origin and reports host errors", async () => {
  const h = harness('{"schemaVersion":1}');
  const request = { type: "HABITS_EXPORT_REQUEST", requestId: "1" };
  await h.dispatch(request, "https://elsewhere.test");
  await h.dispatch(request, undefined, {});
  assert.equal(h.saved, undefined);
  h.api.downloadFile = async () => {
    throw new Error("Disk error");
  };
  await h.dispatch(request);
  assert.equal(h.response.ok, false);
  assert.match(h.response.error, /Disk error/);
});
test("export of empty storage is a valid empty backup", async () => {
  const h = harness(null);
  await h.dispatch({ type: "HABITS_EXPORT_REQUEST", requestId: "1" });
  assert.deepEqual(JSON.parse(h.saved.data).habits, []);
});
test("Electron host accepts an opaque origin only from its own plugin iframe", async () => {
  const h = harness(null);
  h.window.location.origin = "file://";
  const request = { type: "HABITS_EXPORT_REQUEST", requestId: "file" };
  await h.dispatch(request, "null", {});
  assert.equal(h.saved, undefined);
  await h.dispatch(request, "null");
  assert.equal(h.response.ok, true);
  assert.deepEqual(JSON.parse(h.saved.data).habits, []);
});
test("offline emoji catalog is served only to the plugin frame without storage or download calls", async () => {
  const h = harness(null);
  let reads = 0;
  h.api.loadSyncedData = async () => {
    reads++;
    throw new Error("Storage must not be read");
  };
  const request = { type: "HABITS_EXPORT_REQUEST", requestId: "emoji", asset: "emojis" };
  await h.dispatch(request, "https://elsewhere.test");
  assert.equal(h.response, undefined);
  await h.dispatch(request, undefined, {});
  assert.equal(h.response, undefined);
  await h.dispatch(request);
  assert.equal(h.response.ok, true);
  assert.equal(typeof h.response.catalog, "string");
  assert.equal(reads, 0);
  assert.equal(h.saved, undefined);
});
test("translation assets are private to the plugin iframe and never access habit storage", async () => {
  const h = harness(null);
  h.api.loadSyncedData = async () => {
    throw Error("Must not read storage");
  };
  const request = {
    type: "HABITS_EXPORT_REQUEST",
    requestId: "language",
    asset: "translations"
  };
  await h.dispatch(request, undefined, {});
  assert.equal(h.response, undefined);
  await h.dispatch(request);
  assert.equal(h.response.messages["Habits"], russian.Habits);
  assert.equal(h.saved, undefined);
});
test("system emoji bridge reports desktop support and opens only for a trusted explicit request", async () => {
  const h = harness(null);
  let opened = 0;
  h.window.ea = {
    isLinux: () => false,
    showEmojiPanel: () => {
      opened++;
    }
  };
  h.api.loadSyncedData = async () => {
    throw Error("Must not read storage");
  };
  const request = { type: "HABITS_SYSTEM_EMOJI_REQUEST", requestId: "native" };
  await h.dispatch(request);
  assert.equal(h.response.available, true);
  assert.equal(opened, 0);
  await h.dispatch({ ...request, open: true }, "https://other.test");
  await h.dispatch({ ...request, open: true }, undefined, {});
  assert.equal(opened, 0);
  await h.dispatch({ ...request, open: true });
  assert.equal(opened, 1);
  assert.equal(h.response.type, "HABITS_SYSTEM_EMOJI_RESPONSE");
  assert.equal(h.response.ok, true);
  assert.equal(h.saved, undefined);
});
test("system emoji bridge falls back on web and Linux without exporting or touching data", async () => {
  for (const desktop of [
    undefined,
    {
      isLinux: () => true,
      showEmojiPanel: () => {
        throw Error("Must not open");
      }
    }
  ]) {
    const h = harness(null);
    h.window.ea = desktop;
    h.api.loadSyncedData = async () => {
      throw Error("Must not read storage");
    };
    const request = { type: "HABITS_SYSTEM_EMOJI_REQUEST", requestId: "native" };
    await h.dispatch(request);
    assert.equal(h.response.available, false);
    await h.dispatch({ ...request, open: true });
    assert.equal(h.response.ok, false);
    assert.equal(h.saved, undefined);
  }
});
