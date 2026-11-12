import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { MAX_STORAGE_CHARACTERS, MAX_BACKUP_BYTES } from "../src/data-limits.js";
import { createStore } from "../src/store.js";
import { mountBackupControls } from "../src/ui/backup-controls.js";

test("the store rejects excess encoded capacity before calling the storage API", async () => {
  let raw = JSON.stringify(D.emptyState("Europe/Moscow")),
    writes = 0;
  const store = createStore({
    loadSyncedData: async () => raw,
    persistDataSynced: async (value) => {
      writes++;
      raw = value;
    }
  });
  await store.reload();
  await store.mutate((state) => {
    state.extension = "";
    state.extension = "a".repeat(MAX_STORAGE_CHARACTERS - JSON.stringify(state).length);
    return state;
  });
  const confirmed = raw;
  assert.equal(raw.length, MAX_STORAGE_CHARACTERS);
  await assert.rejects(
    store.mutate((state) => ({ ...state, extension: state.extension + "a" })),
    /4 million characters/
  );
  assert.equal(writes, 1);
  assert.equal(raw, confirmed);
  assert.equal(store.snapshot().blocked, true);
  assert.equal(await store.reload(), true);
  assert.equal(D.encodeState(store.snapshot().state), confirmed);
});

test("import rejects an oversized compact history and bounds formatted input", () => {
  const state = D.emptyState("Europe/Moscow");
  state.extension = "a".repeat(MAX_STORAGE_CHARACTERS);
  assert.throws(() => D.parseBackup(JSON.stringify(state)), /4 million characters/);
  assert.throws(() => D.parseBackup(" ".repeat(MAX_BACKUP_BYTES + 1)), /12 MB/);
  assert.throws(() => D.parseBackup("{broken"), SyntaxError);
});

test("import checks file bytes before reading and keeps confirmed history on rejection or cancellation", async () => {
  const handlers = new Map(),
    input = {},
    messages = [],
    raw = JSON.stringify(D.emptyState("Europe/Moscow"));
  let writes = 0,
    reads = 0,
    confirmed = false;
  const store = createStore({
    loadSyncedData: async () => raw,
    persistDataSynced: async () => writes++
  });
  await store.reload();
  mountBackupControls({
    dom: {
      byId: () => input,
      on: (id, name, handler) => handlers.set(id + ":" + name, handler),
      isActive: () => true
    },
    store,
    commit: async (transform) => {
      await store.mutate(transform);
      return true;
    },
    render: () => {},
    flash: (message) => messages.push(message),
    resetDay: () => {},
    exportClient: {},
    confirm: () => confirmed
  });
  const change = handlers.get("import-file:change");
  await change({
    target: {
      files: [
        {
          size: MAX_BACKUP_BYTES + 1,
          text: async () => {
            reads++;
            return raw;
          }
        }
      ]
    }
  });
  assert.equal(reads, 0);
  assert.match(messages.at(-1), /12 MB/);
  const file = { size: Buffer.byteLength(raw), text: async () => raw };
  await change({ target: { files: [file] } });
  assert.equal(writes, 0);
  assert.equal(D.encodeState(store.snapshot().state), raw);
  confirmed = true;
  await change({ target: { files: [file] } });
  assert.equal(writes, 1);
  assert.equal(messages.at(-1), "History imported.");
  const unicode = D.emptyState("Europe/Moscow");
  unicode.extension = "漢".repeat(1500000);
  const unicodeRaw = D.encodeState(unicode),
    size = Buffer.byteLength(unicodeRaw);
  assert.ok(size > MAX_STORAGE_CHARACTERS && size < MAX_BACKUP_BYTES);
  await change({ target: { files: [{ size, text: async () => unicodeRaw }] } });
  assert.equal(writes, 2);
  assert.equal(D.encodeState(store.snapshot().state), unicodeRaw);
});
