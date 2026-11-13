import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
import { createStore } from "../src/store.js";
import { createStatisticsView } from "../src/ui/statistics-view.js";
import { createEmojiPicker } from "../src/ui/emoji-picker.js";
import { createDayView } from "../src/ui/day-view.js";
import { createCalendarView } from "../src/ui/calendar-view.js";

function harness() {
  const fields = new Map(),
    handlers = new Map();
  let active = null,
    narrow = true;
  const mediaHandlers = new Set();
  const media = {
    get matches() {
      return narrow;
    },
    addEventListener: (_type, callback) => mediaHandlers.add(callback),
    removeEventListener: (_type, callback) => mediaHandlers.delete(callback)
  };
  let time = 0,
    nextTimer = 0;
  const timers = new Map();
  const document = {
    defaultView: {
      matchMedia: () => media,
      performance: { now: () => time },
      setTimeout(callback, delay) {
        const id = ++nextTimer;
        timers.set(id, { callback, at: time + delay });
        return id;
      },
      clearTimeout: (id) => timers.delete(id)
    }
  };
  function node(tag, text = "", className = "") {
    const el = {
      tag,
      textContent: text,
      className,
      dataset: {},
      children: [],
      attributes: {},
      style: {},
      value: "",
      disabled: false,
      hidden: false,
      ownerDocument: document,
      append(...items) {
        for (const item of items) {
          if (item.tag === "fragment") this.append(...item.children);
          else {
            this.children.push(item);
            item.parentElement = this;
          }
        }
      },
      insertBefore(item, before) {
        item.remove();
        const index = before ? this.children.indexOf(before) : this.children.length;
        this.children.splice(index, 0, item);
        item.parentElement = this;
      },
      removeChild(item) {
        item.remove();
        item.parentElement = null;
      },
      replaceChild(item, previous) {
        this.insertBefore(item, previous);
        this.removeChild(previous);
      },
      remove() {
        if (this.parentElement)
          this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
      },
      after(item) {
        const parent = this.parentElement;
        parent.children.splice(parent.children.indexOf(this) + 1, 0, item);
        item.parentElement = parent;
      },
      prepend(...items) {
        for (const item of items.reverse()) {
          this.children.unshift(item);
          item.parentElement = this;
        }
      },
      querySelector(selector) {
        return this.querySelectorAll(selector)[0] ?? null;
      },
      replaceChildren(...items) {
        this.children = [];
        this.append(...items);
      },
      addEventListener(type, callback) {
        this["on" + type] = callback;
      },
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      getAttribute(name) {
        return this.attributes[name];
      },
      setCustomValidity(message) {
        this.validationMessage = message;
      },
      reportValidity() {
        return !this.querySelectorAll("*").some((child) => child.validationMessage);
      },
      checkValidity() {
        return !this.validationMessage;
      },
      focus() {
        active = this;
      },
      scrollIntoView(options) {
        this.scrolled = options;
      },
      querySelectorAll(selector) {
        return this.children
          .flatMap((child) => [child, ...child.querySelectorAll("*")])
          .filter(
            (child) =>
              selector === "*" ||
              selector.split(", ").includes(child.tag) ||
              child.className.split(" ").includes(selector.slice(1))
          );
      },
      getBoundingClientRect() {
        return this.box ?? { top: 0, left: 0, width: 40, height: 40 };
      },
      get lastElementChild() {
        return this.children.at(-1);
      }
    };
    el.classList = {
      add(name) {
        this.toggle(name, true);
      },
      contains(name) {
        return el.className.split(" ").includes(name);
      },
      remove(name) {
        this.toggle(name, false);
      },
      toggle(name, enabled) {
        const classes = new Set(el.className.split(" "));
        if (enabled) classes.add(name);
        else classes.delete(name);
        el.className = [...classes].join(" ");
      }
    };
    return el;
  }
  const byId = (id) => {
    if (!fields.has(id)) {
      const el = node("control");
      el.id = id;
      fields.set(id, el);
    }
    return fields.get(id);
  };
  const dom = {
    byId,
    node,
    fragment: () => node("fragment"),
    activeElement: () => active,
    restoreFocus: (key) => {
      for (const field of fields.values())
        field
          .querySelectorAll("*")
          .find((el) => el.dataset.focusKey === key)
          ?.focus();
    },
    button: (text, action, label, cls) => {
      const el = node("button", text, cls);
      el.click = action;
      el.setAttribute("aria-label", label);
      return el;
    },
    isActive: () => true,
    on: (id, type, callback) => handlers.set(id + ":" + type, callback)
  };
  node("section").append(byId("calendar-day-title"), byId("calendar-day-habits"));
  node("section").append(byId("calendar-summary"), byId("calendar-grid"));
  return {
    dom,
    byId,
    node,
    active: () => active,
    send: (id, type, extra = {}) =>
      handlers.get(id + ":" + type)?.({
        preventDefault() {},
        target: byId(id),
        ...extra
      }),
    media(value) {
      narrow = value;
      for (const callback of mediaHandlers) callback();
    },
    mediaListeners: () => mediaHandlers.size,
    advance(ms) {
      time += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= time) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
    timers: () => timers.size
  };
}

const today = "2026-11-12";

test("unapplied custom statistics dates survive filters and refresh while the result range remains explicit", () => {
  const h = harness();
  const state = D.emptyState("UTC");
  const refresh = () => view.render(state, today);
  const view = createStatisticsView({
    dom: h.dom,
    store: { snapshot: () => ({ state }) },
    now: () => today,
    render: refresh
  });
  refresh();
  h.byId("stats-presets")
    .children.find((el) => el.dataset.preset === "custom")
    .click();
  h.byId("stats-from").value = "2026-11-03";
  h.send("stats-from", "input");
  h.byId("stats-to").value = "2026-11-09";
  h.send("stats-to", "input");
  h.send("stats-hidden", "click");
  refresh();
  assert.equal(h.byId("stats-from").value, "2026-11-03");
  assert.equal(h.byId("stats-to").value, "2026-11-09");
  assert.equal(h.byId("stats-caption").hidden, false);
  assert.match(h.byId("stats-caption").textContent, /6 Nov.*12 Nov/);
  h.send("stats-form", "submit");
  assert.match(h.byId("stats-caption").textContent, /3 Nov.*9 Nov/);
  h.byId("stats-from").value = "";
  h.send("stats-from", "input");
  refresh();
  assert.equal(h.byId("stats-from").value, "");
  h.byId("stats-presets")
    .children.find((el) => el.dataset.preset === "7d")
    .click();
  assert.equal(h.byId("stats-from").value, "2026-11-06");
  assert.equal(h.byId("stats-to").value, today);
});

test("emoji vertical navigation follows rendered rows after resizing and clamps a partial last row", () => {
  const h = harness();
  createEmojiPicker({ dom: h.dom, select() {}, loadData: async () => [] });
  const grid = h.byId("emoji-results");
  const items = Array.from({ length: 17 }, () => h.node("button"));
  grid.append(...items);
  function layout(columns) {
    items.forEach((el, i) => {
      el.box = { top: Math.floor(i / columns) * 44, left: (i % columns) * 44 };
    });
  }
  const key = (index, key) => h.send("emoji-results", "keydown", { target: items[index], key });
  layout(6);
  key(0, "ArrowDown");
  assert.equal(h.active(), items[6]);
  key(6, "ArrowUp");
  assert.equal(h.active(), items[0]);
  layout(8);
  key(0, "ArrowDown");
  assert.equal(h.active(), items[8]);
  key(15, "ArrowDown");
  assert.equal(h.active(), items[16]);
  key(16, "ArrowDown");
  assert.equal(h.active(), items[16]);
  key(16, "ArrowUp");
  assert.equal(h.active(), items[8]);
});

test("narrow calendar selection reveals every habit and returns to its date without changing data", () => {
  const h = harness();
  const state = D.createHabit(
    D.emptyState("UTC"),
    {
      name: "Reading",
      limit: 1,
      startDate: "2026-11-01",
      initialCount: 0
    },
    today,
    "reading"
  );
  state.habits[0].notes = { "2026-11-07": "A daily note" };
  const raw = JSON.stringify(state);
  const refresh = () => view.render(state, today);
  const view = createCalendarView({
    dom: h.dom,
    store: { snapshot: () => ({ state }) },
    now: () => today,
    render: refresh,
    selectedDate: () => today,
    selectDate() {},
    openEditor() {},
    openCountEditor() {},
    openPlan() {}
  });
  refresh();
  assert.equal(h.byId("calendar-compact").hidden, true);
  const dates = () => h.byId("calendar-grid").querySelectorAll(".calendar-date-select");
  const seventh = dates().find((el) => el.dataset.focusKey === "cal-date-2026-11-07");
  assert.match(seventh.getAttribute("aria-label"), /Daily notes available/);
  seventh.click();
  assert.equal(h.active(), h.byId("calendar-day-title"));
  assert.equal(h.byId("calendar-day-title").scrolled.block, "start");
  const detailMark = h.byId("calendar-day-habits").children[0];
  assert.match(detailMark.getAttribute("aria-label"), /Reading.*Daily note available/);
  assert.equal(
    detailMark.children.some((el) => el.className === "calendar-note-indicator"),
    true
  );
  const back = h
    .byId("calendar-day-title")
    .parentElement.children.find((el) => el.className.includes("calendar-return"));
  back.click();
  assert.equal(h.active().dataset.focusKey, "cal-date-2026-11-07");
  h.media(false);
  assert.equal(h.byId("calendar-compact").hidden, false);
  assert.equal(back.hidden, false);
  h.send("calendar-compact", "click");
  assert.equal(h.byId("calendar-compact").getAttribute("aria-pressed"), "true");
  h.media(true);
  h.send("calendar-compact", "click");
  assert.equal(h.byId("calendar-compact").getAttribute("aria-pressed"), "true");
  assert.equal(JSON.stringify(state), raw);
  view.dispose();
  assert.equal(h.mediaListeners(), 0);
});

test("Day note shortcuts and motion feedback preserve data and only acknowledge confirmed saves", async () => {
  const h = harness();
  let state = D.createHabit(
    D.emptyState("UTC"),
    {
      name: "Reading",
      goal: "at-least",
      limit: 1,
      initialCount: 0,
      startDate: today
    },
    today,
    "reading"
  );
  state.habits[0].notes = { [today]: "A saved note" };
  const snapshot = () => ({ state, pending: 0, blocked: false, busyRead: false });
  let finish;
  const opened = [];
  const refresh = () => day.render(snapshot(), today);
  const day = createDayView({
    dom: h.dom,
    store: { snapshot },
    now: () => today,
    render: refresh,
    flash() {},
    commit: (transform) =>
      new Promise((resolve) => {
        finish = (ok) => {
          if (ok) state = transform(state);
          refresh();
          resolve(ok);
        };
      }),
    openNoteEditor: (habit, date) => opened.push([habit.id, date]),
    confirm: () => true,
    newId: () => "new",
    openEditor() {},
    openCountEditor() {},
    openDetails() {}
  });
  day.prepare(today);
  refresh();
  const row = () => h.byId("cards").children[0];
  row().querySelector(".habit-note-indicator").click();
  assert.deepEqual(opened, [["reading", today]]);
  row().querySelector(".habit-expand").click();
  assert.equal(row().classList.contains("is-expanding"), true);
  refresh();
  assert.equal(row().classList.contains("is-expanding"), false);
  row().querySelector(".plus").click();
  assert.equal(row().classList.contains("is-confirmed"), false);
  assert.equal(row().querySelector(".habit-feedback"), null);
  finish(true);
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(row().classList.contains("is-confirmed"), true);
  assert.equal(row().querySelector(".habit-feedback").textContent, "Saved");
  assert.equal(state.habits[0].counts[today], 1);
  // The host sends its own persisted-data invalidation after acknowledging a write.
  refresh();
  assert.equal(row().classList.contains("is-confirmed"), true);
  assert.equal(row().querySelector(".habit-feedback").textContent, "Saved");
  h.advance(1999);
  refresh();
  assert.equal(row().classList.contains("is-confirmed"), true);
  h.advance(1);
  assert.equal(row().classList.contains("is-confirmed"), false);
  assert.equal(row().querySelector(".habit-feedback"), null);
  assert.equal(h.timers(), 0);
  row().querySelector(".plus").click();
  finish(false);
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(row().classList.contains("is-confirmed"), false);
  assert.equal(row().querySelector(".habit-feedback"), null);
  assert.equal(state.habits[0].counts[today], 1);
  assert.equal(state.habits[0].notes[today], "A saved note");
  row().querySelector(".plus").click();
  day.cancelReordering();
  finish(true);
  for (let i = 0; i < 5; i++) await Promise.resolve();
  refresh();
  assert.equal(row().classList.contains("is-confirmed"), false);
  assert.equal(h.timers(), 0);
  row().querySelector(".plus").click();
  finish(true);
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(h.timers(), 1);
  day.dispose();
  assert.equal(h.timers(), 0);
  assert.equal(row().classList.contains("is-confirmed"), false);
  h.advance(3000);
  assert.equal(h.timers(), 0);
});

test("Day explains zero assessable goals for empty, rest, inactive and empty-filter views", () => {
  const daily = D.createHabit(
    D.emptyState("UTC"),
    {
      name: "Reading",
      goal: "at-least",
      limit: 1,
      initialCount: 0,
      startDate: "2026-11-01"
    },
    today,
    "reading"
  );
  const rest = D.createHabit(
    D.emptyState("UTC"),
    {
      name: "Practice",
      goal: "at-least",
      limit: 1,
      initialCount: 0,
      startDate: "2026-11-01",
      manualSchedule: { type: "weekdays", days: [0] }
    },
    today,
    "practice"
  );
  for (const scenario of [
    { state: D.emptyState("UTC"), date: today, filter: "active", empty: true },
    { state: rest, date: today, filter: "active" },
    { state: daily, date: "2026-10-31", filter: "active" },
    { state: daily, date: today, filter: "hidden" }
  ]) {
    const h = harness();
    const state = scenario.state,
      original = D.encodeState(state);
    const snapshot = () => ({ state, pending: 0, blocked: false, busyRead: false });
    const refresh = () => day.render(snapshot(), today);
    const day = createDayView({
      dom: h.dom,
      store: { snapshot },
      now: () => today,
      render: refresh,
      flash() {},
      commit: () => assert.fail("Viewing an empty assessment must not write history"),
      openEditor() {},
      openCountEditor() {},
      openNoteEditor() {},
      openDetails() {},
      confirm: () => true,
      newId: () => "new"
    });
    day.prepare(today);
    day.select(scenario.date);
    h.send(scenario.filter, "click");
    assert.equal(h.byId("summary").textContent, "No goals to assess for this day.");
    if (scenario.empty)
      assert.equal(
        h
          .byId("cards")
          .querySelectorAll("*")
          .some((el) => el.textContent === "Select Add habit to create a habit."),
        true
      );
    assert.equal(D.encodeState(state), original);
    day.dispose();
  }
});

test("Calendar exposes a visible empty-filter message and preserves the applied month while a picker draft is invalid", () => {
  const h = harness();
  const state = D.createHabit(
    D.emptyState("UTC"),
    {
      name: "Reading",
      limit: 1,
      initialCount: 0,
      startDate: "2026-11-01"
    },
    today,
    "reading"
  );
  const original = D.encodeState(state);
  const refresh = () => calendar.render(state, today);
  const calendar = createCalendarView({
    dom: h.dom,
    store: { snapshot: () => ({ state }) },
    now: () => today,
    render: refresh,
    selectedDate: () => today,
    selectDate() {},
    openEditor() {},
    openCountEditor() {},
    openPlan() {}
  });
  refresh();
  const message = h
    .byId("calendar-summary")
    .parentElement.children.find((el) => el.id === "calendar-empty-state");
  assert.equal(message.hidden, true);
  h.media(false);
  h.send("calendar-archived", "click");
  assert.equal(message.hidden, false);
  assert.equal(message.textContent, "No habits match this filter.");
  assert.equal(message.getAttribute("role"), "status");
  const month = h.byId("calendar-month");
  const feedback = h
    .byId("calendar-summary")
    .parentElement.children.find((el) => el.className === "calendar-month-feedback");
  const error = feedback.children[0],
    applied = feedback.children[1];
  month.value = "";
  h.send("calendar-month", "input");
  assert.equal(error.hidden, true);
  assert.match(applied.textContent, /Displayed month: November 2026/);
  h.send("calendar-month", "blur");
  assert.equal(error.hidden, false);
  assert.match(error.textContent, /Choose a month/);
  assert.equal(feedback.hidden, false);
  refresh();
  assert.equal(month.value, "");
  assert.equal(
    h.byId("calendar-grid").children.some((el) => el.dataset.date === "2026-11-01"),
    true
  );
  month.value = "2026-10";
  h.send("calendar-month", "input");
  assert.equal(error.hidden, true);
  h.send("calendar-month", "change");
  assert.equal(feedback.hidden, true);
  assert.equal(
    h.byId("calendar-grid").children.some((el) => el.dataset.date === "2026-10-01"),
    true
  );
  month.value = "";
  h.send("calendar-month", "input");
  h.send("calendar-month", "change");
  h.send("calendar-prev", "click");
  assert.equal(month.value, "2026-09");
  assert.equal(month.validationMessage, "");
  assert.equal(feedback.hidden, true);
  assert.equal(D.encodeState(state), original);
  calendar.dispose();
});

test("wide Calendar date selection reveals its controlled details and returns focus to the date", () => {
  const h = harness();
  h.media(false);
  const state = D.createHabit(
    D.emptyState("UTC"),
    {
      name: "Reading",
      limit: 1,
      initialCount: 0,
      startDate: "2026-11-01"
    },
    today,
    "reading"
  );
  const original = D.encodeState(state);
  const refresh = () => calendar.render(state, today);
  const calendar = createCalendarView({
    dom: h.dom,
    store: { snapshot: () => ({ state }) },
    now: () => today,
    render: refresh,
    selectedDate: () => today,
    selectDate() {},
    openEditor() {},
    openCountEditor() {},
    openPlan() {}
  });
  refresh();
  const title = h.byId("calendar-day-title"),
    panel = title.parentElement;
  const back = panel.children.find((el) => el.className.includes("calendar-return"));
  assert.equal(panel.classList.contains("is-revealed"), false);
  assert.equal(back.hidden, true);
  const date = h
    .byId("calendar-grid")
    .querySelectorAll(".calendar-date-select")
    .find((el) => el.dataset.focusKey === "cal-date-2026-11-07");
  date.click();
  assert.equal(panel.classList.contains("is-revealed"), true);
  assert.equal(back.hidden, false);
  assert.equal(h.active(), title);
  assert.equal(title.scrolled.block, "start");
  assert.match(
    h.byId("calendar-day-habits").children[0].getAttribute("aria-label"),
    /Reading.*7 November/
  );
  back.click();
  assert.equal(h.active().dataset.focusKey, "cal-date-2026-11-07");
  assert.equal(h.active().scrolled.block, "center");
  h.media(true);
  h.media(false);
  assert.equal(back.hidden, false);
  assert.equal(panel.classList.contains("is-revealed"), true);
  assert.equal(D.encodeState(state), original);
  calendar.dispose();
});

test("Day retains unchanged rows and controls through pending writes, refreshes and feedback expiry", async () => {
  const h = harness();
  let state = D.emptyState("UTC");
  for (const id of ["reading", "coffee"])
    state = D.createHabit(
      state,
      { name: id, limit: 10, initialCount: 0, startDate: today },
      today,
      id
    );
  state.groups = [{ id: "routine", name: "Routine" }];
  state.habits[0].groupId = "routine";
  let pending = 0,
    busyRead = false,
    blocked = false;
  const snapshot = () => ({ state, pending, busyRead, blocked });
  const refresh = () => day.render(snapshot(), today);
  let finish;
  const day = createDayView({
    dom: h.dom,
    store: { snapshot },
    now: () => today,
    render: refresh,
    commit: (transform) => {
      pending++;
      refresh();
      return new Promise((resolve) => {
        finish = (ok) => {
          if (ok) state = transform(state);
          else blocked = true;
          pending--;
          refresh();
          resolve(ok);
        };
      });
    },
    flash() {},
    openEditor() {},
    openCountEditor() {},
    openNoteEditor() {},
    openDetails() {},
    confirm: () => true,
    newId: () => "new"
  });
  day.prepare(today);
  refresh();
  const rows = () => h.byId("cards").children.filter((el) => el.dataset.habitId);
  const [reading, coffee] = rows();
  const heading = h.byId("cards").children[0];
  const plus = reading.querySelector(".plus");
  plus.focus();
  plus.click();
  assert.deepEqual(rows(), [reading, coffee]);
  assert.equal(h.byId("cards").children[0], heading);
  assert.equal(reading.querySelector(".plus"), plus);
  assert.equal(plus.disabled, true);
  finish(true);
  for (let i = 0; i < 5; i++) await Promise.resolve();
  const changed = rows()[0];
  assert.notEqual(changed, reading);
  assert.equal(rows()[1], coffee);
  assert.equal(changed.querySelector(".plus").disabled, false);
  assert.equal(changed.querySelector(".minus").disabled, false);
  assert.equal(state.habits[0].counts[today], 1);
  assert.equal(h.active().dataset.focusKey, "reading-plus");
  busyRead = true;
  refresh();
  assert.equal(rows()[0], changed);
  assert.equal(changed.querySelector(".plus").disabled, true);
  state = D.parseState(D.encodeState(state));
  busyRead = false;
  refresh();
  assert.equal(rows()[0], changed);
  assert.equal(changed.querySelector(".plus").disabled, false);
  h.advance(2000);
  assert.equal(rows()[0], changed);
  assert.equal(rows()[1], coffee);
  assert.equal(changed.querySelector(".habit-feedback"), null);
  changed.querySelector(".plus").click();
  finish(false);
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(rows()[0], changed);
  assert.equal(changed.querySelector(".plus").disabled, true);
  assert.equal(coffee.querySelector(".plus").disabled, true);
  assert.equal(state.habits[0].counts[today], 1);
  blocked = false;
  refresh();
  assert.equal(changed.querySelector(".plus").disabled, false);
  assert.equal(coffee.querySelector(".minus").disabled, true);
  day.dispose();
});

test("retained compact check-in controls stay locked after a failed save and recover after reload", async () => {
  const h = harness();
  const initial = D.createHabit(
    D.emptyState("UTC"),
    {
      name: "Walk",
      tracking: "check-in",
      goal: "at-least",
      limit: 1,
      initialCount: 0,
      startDate: today
    },
    today,
    "walk"
  );
  let rejectWrite;
  const store = createStore(
    {
      loadSyncedData: async () => D.encodeState(initial),
      persistDataSynced: () =>
        new Promise((_resolve, reject) => {
          rejectWrite = reject;
        })
    },
    () => day.render(store.snapshot(), today)
  );
  const day = createDayView({
    dom: h.dom,
    store,
    now: () => today,
    render: () => day.render(store.snapshot(), today),
    commit: async (transform) => {
      try {
        await store.mutate(transform);
        return true;
      } catch {
        return false;
      }
    },
    flash() {},
    openEditor() {},
    openCountEditor() {},
    openNoteEditor() {},
    openDetails() {},
    confirm: () => true,
    newId: () => "new"
  });
  day.prepare(today);
  await store.reload();
  const row = h.byId("cards").children[0];
  const done = row.querySelector(".done");
  const saving = done.click();
  for (let i = 0; i < 10 && !rejectWrite; i++) await Promise.resolve();
  assert.equal(h.byId("cards").children[0], row);
  assert.equal(done.disabled, true);
  rejectWrite(new Error("Synthetic write failure"));
  await saving;
  assert.equal(store.snapshot().blocked, true);
  assert.equal(h.byId("cards").children[0], row);
  assert.equal(done.disabled, true);
  assert.equal(row.querySelector(".missed").disabled, true);
  assert.equal(row.querySelector(".habit-feedback"), null);
  assert.deepEqual(store.snapshot().state, initial);
  await store.reload();
  assert.equal(h.byId("cards").children[0], row);
  assert.equal(done.disabled, false);
  assert.equal(row.querySelector(".missed").disabled, false);
  day.dispose();
  store.dispose();
});

test("Day combines ordinary and hidden habits without changing visibility, and reorders the displayed peers", async () => {
  const h = harness();
  let state = D.emptyState("UTC");
  for (const id of ["ordinary", "hidden", "second", "archived"])
    state = D.createHabit(
      state,
      { name: id, goal: "at-least", limit: 1, initialCount: 0, startDate: today },
      today,
      id
    );
  state = D.setHabitHidden(state, "hidden", true);
  state = D.setCount(state, "hidden", today, 1, today);
  state = D.archiveHabit(state, "archived", today);
  const snapshot = () => ({ state, pending: 0, blocked: false, busyRead: false });
  let writes = 0;
  const refresh = () => day.render(snapshot(), today);
  const day = createDayView({
    dom: h.dom,
    store: { snapshot },
    now: () => today,
    render: refresh,
    commit: async (transform) => {
      state = transform(state);
      writes++;
      refresh();
      return true;
    },
    flash() {},
    openEditor() {},
    openCountEditor() {},
    openNoteEditor() {},
    openDetails() {},
    confirm: () => true,
    newId: () => "new"
  });
  const ids = () => h.byId("cards").children.map((row) => row.dataset.habitId);
  day.prepare(today);
  refresh();
  const original = D.encodeState(state);
  assert.deepEqual(ids(), ["ordinary", "second"]);
  assert.equal(h.byId("day-hidden").getAttribute("aria-pressed"), "false");
  assert.match(h.byId("summary").textContent, /0 of 2/);
  const ordinaryRow = h.byId("cards").children[0];
  h.send("day-hidden", "click");
  assert.deepEqual(ids(), ["ordinary", "hidden", "second"]);
  assert.equal(h.byId("cards").children[0], ordinaryRow);
  assert.equal(
    h.byId("cards").children[1].querySelector(".habit-hidden-label").textContent,
    "Hidden"
  );
  assert.match(h.byId("summary").textContent, /1 of 3/);
  assert.equal(h.byId("day-hidden").getAttribute("aria-pressed"), "true");
  refresh();
  day.select(today);
  assert.deepEqual(ids(), ["ordinary", "hidden", "second"]);
  h.send("hidden", "click");
  assert.deepEqual(ids(), ["hidden"]);
  assert.equal(h.byId("day-hidden").disabled, true);
  h.send("day-hidden", "click");
  h.send("archived", "click");
  assert.deepEqual(ids(), ["archived"]);
  assert.equal(h.byId("day-hidden").disabled, true);
  h.send("active", "click");
  assert.deepEqual(ids(), ["ordinary", "hidden", "second"]);
  assert.equal(D.encodeState(state), original);
  assert.equal(writes, 0);
  h.send("arrange", "click");
  const hiddenRow = h.byId("cards").children[1];
  hiddenRow.querySelector(".habit-drag-handle").onkeydown({ key: "ArrowUp", preventDefault() {} });
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(writes, 1);
  assert.deepEqual(ids(), ["hidden", "ordinary", "second"]);
  assert.deepEqual(state.habits, D.parseState(original).habits);
  h.send("day-hidden", "click");
  assert.deepEqual(ids(), ["ordinary", "second"]);
  h.send("hidden", "click");
  assert.deepEqual(ids(), ["hidden"]);
  assert.equal(writes, 1);
  day.reset();
  day.prepare(today);
  refresh();
  assert.deepEqual(ids(), ["ordinary", "second"]);
  assert.equal(h.byId("day-hidden").getAttribute("aria-pressed"), "false");
  day.dispose();
});
