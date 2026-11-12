import russian from "../src/i18n/ru.json" with { type: "json" };
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { bundle } from "../scripts/bundle.mjs";
import * as D from "../src/domain.js";
import { MAX_STORAGE_CHARACTERS, MAX_BACKUP_BYTES } from "../src/data-limits.js";
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

test("normal export and legacy indented backups round trip a history whose old export exceeded 4 MB", async () => {
  const state = D.emptyState("Europe/Moscow");
  const counts = Object.fromEntries(
    Array.from({ length: 1000 }, (_, index) => [D.addDays("2022-01-01", index), 1])
  );
  for (let index = 0; index < 170; index++)
    state.habits.push({
      id: "habit-" + index,
      name: "Synthetic habit " + index,
      startDate: "2022-01-01",
      endDate: null,
      limits: [{ from: "2022-01-01", value: 1, goal: "at-least" }],
      counts
    });
  const raw = D.encodeState(state),
    oldExport = JSON.stringify(state, null, 2);
  assert.ok(raw.length < MAX_STORAGE_CHARACTERS);
  assert.ok(Buffer.byteLength(oldExport) > MAX_STORAGE_CHARACTERS);
  assert.equal(D.encodeState(D.parseBackup(oldExport)), raw);
  const h = harness(raw);
  await h.dispatch({ type: "HABITS_EXPORT_REQUEST", requestId: "large" });
  assert.equal(h.response.ok, true);
  assert.equal(h.saved.data, raw);
  assert.equal(D.encodeState(D.parseBackup(h.saved.data)), raw);
});

test("a full-capacity Unicode backup preserves custom text, legacy notes and unknown fields", async () => {
  const state = D.createHabit(
    D.emptyState("Europe/Moscow"),
    { name: "漢字", unit: "個", limit: 1, initialCount: 1, startDate: "2026-11-01" },
    "2026-11-01",
    "unicode"
  );
  state.habits[0].legacyJournal = {
    "2026-11-01": {
      baseline: 0,
      entries: [{ kind: "add", delta: 1, time: "08:00", note: "漢".repeat(500) }]
    }
  };
  state.extension = { payload: "", retained: { enabled: true } };
  state.extension.payload = "漢".repeat(MAX_STORAGE_CHARACTERS - JSON.stringify(state).length);
  const raw = D.encodeState(state);
  assert.equal(raw.length, MAX_STORAGE_CHARACTERS);
  assert.ok(Buffer.byteLength(raw) > MAX_STORAGE_CHARACTERS);
  assert.ok(Buffer.byteLength(raw) <= MAX_BACKUP_BYTES);
  const h = harness(raw);
  await h.dispatch({ type: "HABITS_EXPORT_REQUEST", requestId: "unicode" });
  const imported = D.parseBackup(h.saved.data);
  assert.equal(D.encodeState(imported), raw);
  assert.deepEqual(imported.habits[0].legacyJournal, state.habits[0].legacyJournal);
  await h.dispatch({ type: "HABITS_EXPORT_REQUEST", requestId: "recovery", recovery: true });
  assert.equal(h.saved.data, raw);
  assert.equal(h.saved.name, "habits-recovery.json");
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
