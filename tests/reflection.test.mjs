import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { createTaskIntegration, reflectionTask } from "../src/task-integration.js";
import { createStore } from "../src/store.js";
import russian from "../src/i18n/ru.json" with { type: "json" };

const today = "2026-11-04";
const instant = () => new Date("2026-11-04T12:00:00Z");
function seed(options = {}) {
  return D.createHabit(
    D.emptyState("Europe/Moscow"),
    {
      name: "Coffee",
      goal: "at-most",
      limit: 1,
      initialCount: 0,
      startDate: "2026-11-01",
      reflectionTask: true,
      step: 2,
      ...options
    },
    today,
    "coffee"
  );
}
function host(state = seed()) {
  let raw = JSON.stringify(state);
  const calls = [];
  const api = {
    loadSyncedData: async () => raw,
    persistDataSynced: async (value) => {
      calls.push("save");
      raw = value;
    },
    getCurrentLanguage: async () => "en",
    addTask: async (task) => {
      assert.equal(task.projectId, "INBOX_PROJECT", "The host rejects unknown project IDs");
      calls.push(task);
      return "review";
    },
    getAppState: async () => ({ tasks: {}, taskRepeatCfgs: {} }),
    getArchivedTasks: async () => []
  };
  const integration = createTaskIntegration(api, () => {}, instant);
  const write = async (delta = 1, date = today) => {
    const expected = raw;
    const next = D.changeCount(D.parseState(raw), "coffee", date, delta, today);
    return integration.request({
      action: "write",
      expected,
      raw: JSON.stringify(next),
      increment: { id: "coffee", date, delta }
    });
  };
  return { api, integration, calls, write, raw: () => raw };
}

test("old habits remain opt-out; reflection settings validate and survive metadata edits/backups", () => {
  const old = seed({ reflectionTask: undefined });
  assert.equal(D.parseState(JSON.stringify(old)).habits[0].reflectionTask, undefined);
  const state = seed();
  const edited = D.editHabit(state, "coffee", { name: "Tea", from: today, limit: 2 }, today);
  assert.equal(D.parseState(JSON.stringify(edited)).habits[0].reflectionTask, true);
  assert.deepEqual(edited.habits[0].counts, state.habits[0].counts);
  assert.throws(() => seed({ reflectionTask: "yes" }), /reflection/);
});

test("quick plus saves first and creates exactly one Inbox review for the entire step", async () => {
  const h = host();
  const result = await h.write();
  assert.equal(JSON.parse(result.raw).habits[0].counts[today], 2);
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[0], "save");
  assert.equal(h.calls[1].projectId, "INBOX_PROJECT");
  assert.equal(h.calls[1].timeEstimate, 180000);
  assert.match(h.calls[1].notes, /Quantity added: 2 times/);
  assert.match(result.effectMessage, /created/);
  await h.write();
  assert.equal(JSON.parse(h.raw()).habits[0].counts[today], 4);
  assert.equal(h.calls.filter((call) => typeof call === "object").length, 2);
});

test("minus, generic corrections/imports, reads and reconciliation never create review tasks", async () => {
  const h = host();
  await h.write();
  h.calls.length = 0;
  await h.write(-1);
  const expected = h.raw();
  await h.integration.request({
    action: "write",
    expected,
    raw: JSON.stringify(D.setCount(D.parseState(expected), "coffee", today, 12, today))
  });
  await h.integration.request({ action: "read" });
  await h.integration.refresh();
  assert.ok(h.calls.every((call) => call === "save"));
  assert.equal(JSON.parse(h.raw()).habits[0].counts[today], 12);
});

test("daily-note host writes cannot create review tasks or quantities", async () => {
  const h = host(),
    expected = h.raw();
  const noted = D.setNote(
    D.parseState(expected),
    "coffee",
    today,
    "Independent observation",
    today
  );
  await h.integration.request({ action: "write", expected, raw: D.encodeState(noted) });
  assert.deepEqual(h.calls, ["save"]);
  assert.deepEqual(D.parseState(h.raw()).habits[0].counts, {});
  assert.equal(D.parseState(h.raw()).habits[0].notes[today], "Independent observation");
});

test("disabled and positive habits do not create tasks, even with a retained flag", async () => {
  for (const options of [
    { reflectionTask: false },
    { reflectionTask: undefined },
    { goal: "at-least" }
  ]) {
    const h = host(seed(options));
    await h.write();
    assert.deepEqual(h.calls, ["save"]);
  }
});

test("past episodes use their selected date and historical goal, not today's goal", async () => {
  const state = D.editHabit(
    seed(),
    "coffee",
    { name: "Coffee", limit: 1, goal: "at-least", from: today },
    today
  );
  const h = host(state);
  await h.write(1, "2026-11-02");
  assert.match(h.calls[1].notes, /2026-11-02 \(Europe\/Moscow\)/);
  await h.write();
  assert.equal(h.calls.filter((call) => typeof call === "object").length, 1);
});

test("stale/replayed or mismatched requests cannot create duplicate or unrelated tasks", async () => {
  const h = host(),
    expected = h.raw();
  const message = {
    action: "write",
    expected,
    raw: JSON.stringify(D.changeCount(D.parseState(expected), "coffee", today, 1, today)),
    increment: { id: "coffee", date: today, delta: 1 }
  };
  await h.integration.request(message);
  await assert.rejects(h.integration.request(message), /changed/);
  const bad = { ...message, expected: h.raw(), raw: h.raw() };
  await assert.rejects(h.integration.request(bad), /counter/);
  assert.equal(h.calls.length, 2);
});

test("a storage failure cannot create a task", async () => {
  const h = host(),
    before = h.raw();
  h.api.persistDataSynced = async () => {
    throw Error("disk unavailable");
  };
  await assert.rejects(h.write(), /disk/);
  assert.equal(h.raw(), before);
  assert.deepEqual(h.calls, []);
});

test("unconfirmed task creation preserves the saved episode, reports recovery and never retries", async () => {
  const h = host();
  let attempts = 0;
  h.api.addTask = async () => {
    attempts++;
    throw Error("lost acknowledgement");
  };
  const result = await h.write();
  assert.equal(JSON.parse(result.raw).habits[0].counts[today], 2);
  assert.match(result.effectMessage, /Do not press \+/);
  await h.integration.refresh();
  await h.integration.request({ action: "read" });
  assert.equal(attempts, 1);
});

test("review tasks use app locale and preserve user names and custom units", async () => {
  const habit = seed().habits[0];
  habit.name = "Custom #name";
  habit.unit = "cups";
  const task = reflectionTask(habit, today, "Europe/Moscow", "ru-RU");
  assert.equal(task.title, russian["Brief review: "] + habit.name);
  assert.ok(task.notes.includes(russian["What was happening?"]));
  assert.ok(task.notes.includes("2 cups"));
  assert.match(reflectionTask(habit, today, "UTC", "de").title, /^Brief review:/);
});

test("the UI store accepts committed storage plus a task warning without blocking future edits", async () => {
  const h = host();
  h.api.addTask = async () => {
    throw Error("offline");
  };
  let expected;
  const store = createStore({
    loadSyncedData: async () => {
      expected = h.raw();
      return expected;
    },
    persistDataSynced: (raw, metadata) =>
      h.integration.request({ action: "write", raw, expected, ...metadata })
  });
  await store.reload();
  await store.mutate((s) => D.changeCount(s, "coffee", today, 1, today), {
    increment: { id: "coffee", date: today, delta: 1 }
  });
  assert.equal(store.snapshot().blocked, false);
  assert.equal(store.snapshot().state.habits[0].counts[today], 2);
  assert.match(store.snapshot().effectMessage, /not confirmed/);
});
