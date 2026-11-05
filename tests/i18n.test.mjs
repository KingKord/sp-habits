import { fixedSchedule } from "../src/task-integration.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import english from "../src/i18n/en.json" with { type: "json" };
import russian from "../src/i18n/ru.json" with { type: "json" };
import aliases from "../src/i18n/unit-aliases.json" with { type: "json" };
import sample from "./fixtures/i18n/ru.json" with { type: "json" };
import { setLanguage, t, getLanguage, localizeDocument } from "../src/i18n/index.js";
import { readAppLanguage } from "../src/i18n/setup.js";
import { dateText, number, percent, habitName, resultLabel } from "../src/ui/format.js";
import { unitChoice, selectedUnit, unitText, localizedAmounts } from "../src/ui/units.js";
import * as D from "../src/domain.js";
import { loadEmojiCatalog, emojiName, searchEmoji } from "../src/ui/emoji-catalog.js";
import { emojiData } from "../src/i18n/emoji-data.js";

test("English is the source and fallback; the SP language wins over browser preferences", async () => {
  assert.equal(getLanguage(), "en");
  assert.equal(t("Habits"), "Habits");
  assert.equal(
    await readAppLanguage({ getCurrentLanguage: async () => "en", cfg: { lang: { code: "ru" } } }),
    "en"
  );
  assert.equal(await readAppLanguage({ getCurrentLanguage: () => "ru" }), "ru");
  assert.equal(
    await readAppLanguage({
      getCurrentLanguage: () => {
        throw Error("old host");
      },
      cfg: { lang: { code: "ru" } }
    }),
    "ru"
  );
  assert.equal(await readAppLanguage({}), "en");
  try {
    for (const code of ["ru", "ru-RU", "RU_ru"]) {
      setLanguage(code, russian);
      assert.equal(getLanguage(), "ru");
      assert.equal(t("Habits"), russian.Habits);
    }
    for (const code of ["en", "en-US", "de", undefined]) {
      setLanguage(code, russian);
      assert.equal(getLanguage(), "en");
      assert.equal(t("Habits"), "Habits");
    }
    setLanguage("ru", {});
    assert.equal(t("A message without a translation"), "A message without a translation");
  } finally {
    setLanguage("en", russian);
  }
});

test("authored English messages and markup have complete Russian translations", () => {
  assert.deepEqual(Object.keys(russian).sort(), Object.keys(english).sort());
  for (const [key, value] of Object.entries(english)) {
    assert.equal(key, value);
    assert.doesNotMatch(key, /\p{Script=Cyrillic}/u);
    const translated = russian[key];
    assert.ok(typeof translated === "string" ? translated.trim() : translated?.other, key);
  }
  const files = [
    "application.js",
    "store.js",
    "task-integration.js",
    "domain.js",
    ...readdirSync(new URL("../src/ui/", import.meta.url))
      .filter((f) => f.endsWith(".js"))
      .map((f) => "ui/" + f),
    "host/export-client.js",
    "host/export-host.js"
  ];
  for (const file of files) {
    const source = readFileSync(new URL("../src/" + file, import.meta.url), "utf8");
    for (const match of source.matchAll(/\bt\(\s*("(?:[^"\\]|\\.)*")/g)) {
      const key = JSON.parse(match[1]);
      assert.ok(Object.hasOwn(english, key), `${file}: ${key}`);
    }
  }
  const html = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  const values = [
    ...[...html.matchAll(/>([^<>]+)</g)].map((m) => m[1].replace(/\s+/g, " ").trim()),
    ...[...html.matchAll(/(?:aria-label|placeholder|title)="([^"]+)"/g)].map((m) => m[1])
  ];
  for (const key of values)
    if (/[a-zA-Z]/.test(key) && !key.startsWith("Habits") && !key.startsWith("/*"))
      assert.ok(Object.hasOwn(english, key), key);
});

test("localized display never translates user names or rewrites custom units and history", () => {
  setLanguage("en", russian);
  const state = D.createHabit(
    D.emptyState("UTC"),
    {
      name: sample.habitName,
      unit: sample.customUnit,
      limit: 1,
      initialCount: 0,
      startDate: "2026-11-04"
    },
    "2026-11-04",
    "a"
  );
  const raw = JSON.stringify(state);
  assert.equal(habitName(state.habits[0]), sample.habitName);
  assert.equal(unitText(sample.customUnit), sample.customUnit);
  assert.equal(dateText("2026-11-04"), "4 November");
  assert.equal(number(1234.5), "1,234.5");
  assert.equal(percent(1 / 3), "33.3%");
  assert.equal(
    resultLabel({ kind: "today-bad", goal: "at-least", editable: true }),
    "Goal not met yet · day in progress"
  );
  assert.throws(() => D.addDays("invalid", 1), /Invalid date/);
  try {
    setLanguage("ru", russian);
    assert.equal(dateText("2026-11-04"), sample.november4);
    assert.match(number(1234.5), /1\s234,5/);
    D.statistics(state, "2026-11-04", "2026-11-04", "2026-11-04");
    assert.equal(habitName(state.habits[0]), sample.habitName);
    assert.equal(unitText(sample.customUnit), sample.customUnit);
    assert.equal(JSON.stringify(state), raw);
  } finally {
    setLanguage("en");
  }
});

test("new presets use English IDs and metadata edits preserve all legacy unit aliases", () => {
  for (const [canonical, legacy] of Object.entries(aliases)) {
    for (const original of [canonical, ...legacy]) {
      assert.equal(unitChoice(original), canonical);
      assert.equal(selectedUnit(canonical, original, ""), original);
      assert.equal(unitText(original), canonical);
      try {
        setLanguage("ru", russian);
        assert.equal(unitText(original), russian[canonical]);
        assert.equal(selectedUnit(canonical, null, ""), canonical);
      } finally {
        setLanguage("en");
      }
    }
  }
  assert.equal(unitChoice(sample.customUnit), "custom");
  assert.equal(selectedUnit("custom", "cups", " cups "), "cups");
  const state = D.createHabit(
    D.emptyState("UTC"),
    { name: "New habit", limit: 1, initialCount: 0, startDate: "2026-11-04" },
    "2026-11-04",
    "new"
  );
  assert.equal(state.habits[0].unit, "times");
});

test("standard units aggregate across old localized and English storage without mutating data", () => {
  const items = [
    { unit: aliases.ml[0], value: 300 },
    { unit: "ml", value: 100 },
    { unit: aliases.min[0], value: 20 },
    { unit: sample.customUnit, value: 2 }
  ];
  const original = JSON.stringify(items);
  assert.deepEqual(localizedAmounts(items), [
    { unit: "ml", value: 400 },
    { unit: "min", value: 20 },
    { unit: sample.customUnit, value: 2 }
  ]);
  assert.equal(JSON.stringify(items), original);
});

test("Russian localization only changes authored English text and accessibility labels", () => {
  setLanguage("ru", russian);
  try {
    const nodes = [
      { textContent: "\n Habits \n", parentElement: { tagName: "H1" } },
      { textContent: '"Habits"', parentElement: { tagName: "SCRIPT" } }
    ];
    const attrs = { "aria-label": "Close form", value: sample.habitName };
    const option = {
      hasAttribute: (key) => Object.hasOwn(attrs, key),
      getAttribute: (key) => attrs[key],
      setAttribute: (key, value) => {
        attrs[key] = value;
      }
    };
    let index = 0;
    const document = {
      documentElement: {},
      body: {},
      createTreeWalker: () => ({ nextNode: () => nodes[index++] }),
      querySelectorAll: () => [option]
    };
    localizeDocument(document);
    assert.equal(document.documentElement.lang, "ru");
    assert.equal(nodes[0].textContent, russian.Habits);
    assert.equal(nodes[1].textContent, '"Habits"');
    assert.equal(attrs["aria-label"], russian["Close form"]);
    assert.equal(attrs.value, sample.habitName);
  } finally {
    setLanguage("en");
  }
});

test("emoji English names are primary, Russian names are translations and search is language-neutral", async () => {
  const groups = await loadEmojiCatalog(async () => emojiData);
  assert.equal(groups[0].name, "Smileys & Emotion");
  const coffee = searchEmoji(groups, sample.coffeeQuery).find((entry) => entry[0] === "☕");
  assert.equal(emojiName(coffee), "hot beverage");
  assert.ok(searchEmoji(groups, "hot beverage").some((entry) => entry[0] === "☕"));
  assert.ok(searchEmoji(groups, "coffee").some((entry) => entry[0] === "☕"));
  assert.ok(searchEmoji(groups, sample.bookQuery).some((entry) => entry[0] === "📚"));
  assert.deepEqual(
    searchEmoji(groups, sample.hedgehog),
    searchEmoji(groups, sample.hedgehogWithoutAccent)
  );
  for (const [, name] of searchEmoji(groups)) assert.doesNotMatch(name, /\p{Script=Cyrillic}/u);
  try {
    setLanguage("ru", russian);
    assert.equal(groups[0].name, russian["Smileys & Emotion"]);
    assert.equal(emojiName(coffee), coffee[3]);
    assert.match(emojiName(coffee), /\p{Script=Cyrillic}/u);
  } finally {
    setLanguage("en");
  }
});

test("legacy localized storage survives reads, metadata edits and recurring-task links unchanged", () => {
  const today = "2026-11-04";
  const original = D.createHabit(
    D.emptyState("Europe/Moscow"),
    {
      name: sample.habitName,
      unit: aliases.times[0],
      goal: "at-least",
      limit: 1,
      initialCount: 0,
      startDate: "2026-11-01"
    },
    today,
    "legacy"
  );
  original.habits[0].counts = { "2026-11-02": 1 };
  const raw = JSON.stringify(original);
  assert.equal(JSON.stringify(D.parseState(raw)), raw);
  const edited = D.editHabit(
    original,
    "legacy",
    {
      name: sample.habitName,
      unit: selectedUnit("times", aliases.times[0], ""),
      goal: "at-least",
      limit: 1,
      from: today
    },
    today
  );
  assert.equal(edited.habits[0].unit, aliases.times[0]);
  assert.deepEqual(edited.habits[0].counts, original.habits[0].counts);
  const schedule = fixedSchedule({
    id: "series",
    title: "Reading",
    repeatCycle: "DAILY",
    repeatEvery: 1,
    startDate: today,
    startTime: "20:00"
  });
  const linked = D.setTaskSchedule(edited, "legacy", schedule, today);
  assert.equal(linked.habits[0].unit, aliases.times[0]);
  assert.equal(linked.habits[0].name, sample.habitName);
  assert.deepEqual(linked.habits[0].counts, original.habits[0].counts);
  assert.equal(JSON.stringify(original), raw);
  const withoutMetadata = structuredClone(original);
  delete withoutMetadata.habits[0].unit;
  const oldRaw = JSON.stringify(withoutMetadata);
  assert.equal(D.unitOf(D.parseState(oldRaw).habits[0]), "times");
  assert.equal(JSON.stringify(D.parseState(oldRaw)), oldRaw);
});
