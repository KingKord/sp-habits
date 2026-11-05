import test from "node:test";
import assert from "node:assert/strict";
import { loadEmojiCatalog, searchEmoji } from "../src/ui/emoji-catalog.js";
import { validEmoji } from "../src/domain.js";
import { emojiData } from "../src/i18n/emoji-data.js";
const loadData = async () => emojiData;

test("offline Unicode catalog loads once and contains unique valid emoji in nine categories", async () => {
  const groups = await loadEmojiCatalog(loadData);
  assert.equal(await loadEmojiCatalog(loadData), groups);
  assert.equal(groups.length, 9);
  const entries = searchEmoji(groups);
  assert.equal(entries.length, 1906);
  assert.equal(new Set(entries.map(([emoji]) => emoji)).size, entries.length);
  for (const [emoji, name] of entries) {
    assert.equal(validEmoji(emoji), true, emoji);
    assert.ok(name.trim().length > 0);
  }
});
test("catalog search supports Russian names, pasted emoji, category filters and empty results", async () => {
  const groups = await loadEmojiCatalog(loadData);
  assert.ok(searchEmoji(groups, "book").some(([emoji]) => emoji === "📚"));
  assert.ok(searchEmoji(groups, "☕").some(([emoji]) => emoji === "☕"));
  assert.ok(searchEmoji(groups, " COFFEE ").some(([emoji]) => emoji === "☕"));
  assert.equal(searchEmoji(groups, "nonexistent_word").length, 0);
  assert.equal(
    searchEmoji(groups, "", "Flags").length,
    groups.find((group) => group.id === "Flags").entries.length
  );
  assert.equal(searchEmoji(groups, "☕", "Flags").length, 0);
});
