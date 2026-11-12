import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../src/store.js";
import { EditConflictError, settingsVersion, assertSettingsVersion } from "../src/edit-session.js";
import * as D from "../src/domain.js";

const today = "2026-11-12";
const sample = () =>
  D.createHabit(
    D.emptyState("UTC"),
    { name: "Reading", startDate: today, limit: 1, initialCount: 0 },
    today,
    "reading"
  );
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

test("invalidations arriving during a read coalesce into a final fresh read without writes", async () => {
  let raw = JSON.stringify(sample()),
    reads = 0,
    release;
  const store = createStore({
    loadSyncedData: async () => {
      reads++;
      const captured = raw;
      if (reads === 2)
        await new Promise((resolve) => {
          release = resolve;
        });
      return captured;
    },
    persistDataSynced: () => assert.fail("A refresh must not write")
  });
  await store.reload();
  store.invalidate();
  const delivered = sample();
  delivered.habits[0].name = "Latest delivery";
  raw = JSON.stringify(delivered);
  for (let i = 0; i < 10; i++) store.invalidate();
  release();
  await settle();
  assert.equal(reads, 3);
  assert.equal(store.snapshot().state.habits[0].name, "Latest delivery");
  assert.equal(store.snapshot().busyRead, false);
});

test("invalidations wait for pending saves and then display the latest delivered state", async () => {
  let raw = JSON.stringify(sample()),
    release,
    writes = 0;
  const store = createStore({
    loadSyncedData: async () => raw,
    persistDataSynced: async (value) => {
      writes++;
      raw = value;
      await new Promise((resolve) => {
        release = resolve;
      });
      return value;
    }
  });
  await store.reload();
  const save = store.mutate((state) => D.changeCount(state, "reading", today, 1, today));
  await settle();
  const delivered = JSON.parse(raw);
  delivered.habits[0].name = "Updated elsewhere";
  raw = JSON.stringify(delivered);
  store.invalidate();
  assert.equal(store.snapshot().pending, 1);
  release();
  await save;
  await settle();
  assert.equal(store.snapshot().state.habits[0].name, "Updated elsewhere");
  assert.equal(store.snapshot().state.habits[0].counts[today], 1);
  assert.equal(writes, 1);
});

test("disposal ignores in-flight refresh results and subsequent invalidations", async () => {
  let release,
    reads = 0,
    notified = 0;
  const store = createStore(
    {
      loadSyncedData: async () => {
        reads++;
        if (reads === 2)
          await new Promise((resolve) => {
            release = resolve;
          });
        return JSON.stringify(sample());
      },
      persistDataSynced: () => assert.fail("A refresh must not write")
    },
    () => notified++
  );
  await store.reload();
  store.invalidate();
  store.dispose();
  const before = notified;
  store.invalidate();
  release();
  await settle();
  assert.equal(reads, 2);
  assert.equal(notified, before);
  assert.equal(await store.reload(), false);
});

test("malformed delivered data preserves history and remains blocked until an explicit reload", async () => {
  let raw = JSON.stringify(sample());
  const store = createStore({
    loadSyncedData: async () => raw,
    persistDataSynced: () => assert.fail("Unexpected write")
  });
  await store.reload();
  raw = "broken";
  store.invalidate();
  await settle();
  assert.equal(store.snapshot().state.habits.length, 1);
  assert.equal(store.snapshot().blocked, true);
  raw = JSON.stringify(sample());
  store.invalidate();
  assert.equal(store.snapshot().blocked, true);
  await store.reload();
  await settle();
  assert.equal(store.snapshot().blocked, false);
});

test("stale settings reject without a write or blocking unrelated updates", async () => {
  let raw = JSON.stringify(sample()),
    writes = 0;
  const store = createStore({
    loadSyncedData: async () => raw,
    persistDataSynced: async (value) => {
      raw = value;
      writes++;
    }
  });
  await store.reload();
  const version = settingsVersion(store.snapshot().state, "reading");
  const delivered = sample();
  delivered.habits[0].name = "External name";
  raw = JSON.stringify(delivered);
  await assert.rejects(
    store.mutate((state) => {
      assertSettingsVersion(state, "reading", version);
      return D.editHabit(state, "reading", { name: "Stale draft", limit: 1, from: today }, today);
    }),
    EditConflictError
  );
  assert.equal(store.snapshot().blocked, false);
  assert.equal(store.snapshot().state.habits[0].name, "External name");
  assert.equal(writes, 0);
  await store.mutate((state) => D.changeCount(state, "reading", today, 1, today));
  assert.equal(writes, 1);
  assert.equal(JSON.parse(raw).habits[0].name, "External name");
  const current = JSON.parse(raw),
    settings = settingsVersion(current, "reading");
  current.habits[0].counts[today] = 2;
  current.habits[0].hidden = true;
  assert.equal(settingsVersion(current, "reading"), settings);
});
