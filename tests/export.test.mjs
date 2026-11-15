import { installExportBridge } from "../src/host/export-host.js";
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
  let handler, unload, saved, response;
  const api = {
    onMessage: (fn) => {
      handler = fn;
    },
    loadSyncedData: async () => raw,
    downloadFile: async (name, data) => {
      saved = { name, data };
    },
    onUnload: (fn) => {
      unload = fn;
    }
  };
  // No host document or parent DOM is available to the shipped plugin.
  vm.runInNewContext(script, { PluginAPI: api, Intl, JSON });
  return {
    api,
    unload: () => unload(),
    get saved() {
      return saved;
    },
    get response() {
      return response;
    },
    dispatch: async (data) => {
      response = await handler(data);
      return response;
    }
  };
}
test("export uses the host download API and preserves malformed data for recovery", async () => {
  const h = harness("{broken");
  await h.dispatch({ type: "HABITS_EXPORT_REQUEST", requestId: "1", recovery: true });
  assert.equal(h.saved.name, "habits-recovery.json");
  assert.equal(h.saved.data, "{broken");
  assert.equal(h.response.ok, true);
  h.unload();
  await h.dispatch({ type: "HABITS_EXPORT_REQUEST" });
  assert.equal(h.response.ok, false);
});
test("public handler rejects unrelated message channels and reports host download errors", async () => {
  const h = harness('{"schemaVersion":1}');
  await h.dispatch({ type: "UNRELATED_PLUGIN_MESSAGE" });
  assert.equal(h.saved, undefined);
  assert.equal(h.response.ok, false);
  h.api.downloadFile = async () => {
    throw new Error("Disk error");
  };
  await h.dispatch({ type: "HABITS_EXPORT_REQUEST" });
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
test("offline resources and revision status do not access habit storage", async () => {
  const h = harness(null);
  h.api.loadSyncedData = async () => assert.fail("Resource lookups must not read history");
  for (const asset of ["emojis", "translations", "application", "status"]) {
    await h.dispatch({ type: "HABITS_EXPORT_REQUEST", asset });
    assert.equal(h.response.ok, true);
    if (asset === "emojis") assert.equal(typeof h.response.catalog, "string");
    if (asset === "translations") {
      assert.equal(h.response.messages.Habits, russian.Habits);
      assert.match(h.response.styles, /calendar-grid/);
    }
    if (asset === "application") assert.doesNotThrow(() => new vm.Script(h.response.source));
    if (asset === "status") assert.equal(h.response.revision, 0);
  }
  assert.equal(h.saved, undefined);
});

test("private native emoji messages are rejected without touching storage or a preload bridge", async () => {
  const h = harness(null);
  h.api.loadSyncedData = async () => assert.fail("Must not read storage");
  await h.dispatch({ type: "HABITS_SYSTEM_EMOJI_REQUEST", open: true });
  assert.equal(h.response.ok, false);
  assert.equal(h.saved, undefined);
});

test("public handler returns authorized asynchronous results and rejects requests after unload", async () => {
  let handler,
    release,
    completed = 0;
  const stop = installExportBridge(
    {
      onMessage: (fn) => {
        handler = fn;
      }
    },
    {
      request: async () => {
        await new Promise((resolve) => {
          release = resolve;
        });
        completed++;
        return { raw: "confirmed write" };
      }
    }
  );
  const request = { type: "HABITS_EXPORT_REQUEST", asset: "tasks", action: "write" };
  const pending = handler(request);
  stop();
  release();
  assert.equal((await pending).raw, "confirmed write");
  assert.equal(completed, 1);
  assert.equal((await handler(request)).ok, false);
  assert.equal(completed, 1);
});

test("shortcut response discloses only the configured add-task combo", async () => {
  const h = harness(null);
  h.api.getAppState = async () => ({
    globalConfig: {
      keyboard: { addNewTask: "Ctrl+Alt+N", globalAddTask: "Ctrl+G" },
      privateExtension: "private"
    },
    tasks: { privateTask: {} }
  });
  h.api.loadSyncedData = async () => assert.fail("Must not read storage");
  const request = { type: "HABITS_EXPORT_REQUEST", asset: "shortcuts" };
  await h.dispatch(request);
  assert.deepEqual(JSON.parse(JSON.stringify(h.response)), { ok: true, addNewTask: "Ctrl+Alt+N" });
  for (const combo of [null, "x".repeat(101)]) {
    h.api.getAppState = async () => ({ globalConfig: { keyboard: { addNewTask: combo } } });
    await h.dispatch(request);
    assert.equal(h.response.addNewTask, null);
  }
});
