import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/domain.js";
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
            (child) => selector === "*" || child.className.split(" ").includes(selector.slice(1))
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
    on: (id, type, callback) => handlers.set(id + ":" + type, callback)
  };
  node("section").append(byId("calendar-day-title"), byId("calendar-day-habits"));
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
  assert.equal(back.hidden, true);
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
