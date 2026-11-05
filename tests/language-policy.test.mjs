import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const translated = new Set([
  "src/i18n/ru.json",
  "src/i18n/unit-aliases.json",
  "tests/fixtures/i18n/ru.json"
]);
function walk(dir) {
  return readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const file = resolve(root, dir, entry.name);
    const name = relative(root, file).split(sep).join("/");
    return entry.isDirectory() ? walk(name) : [name];
  });
}

test("Russian text is restricted to translation resources and translation fixtures", () => {
  const files = [
    ...["src", "scripts", "tests", ".github", "docs"].flatMap(walk),
    "README.md",
    "DRAFT.md",
    "VERIFICATION.md",
    "AGENTS.md",
    "CHANGELOG.md",
    "package.json",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
    "SECURITY.md"
  ];
  for (const file of files) {
    if (translated.has(file) || /\.png$/.test(file)) continue;
    assert.doesNotMatch(readFileSync(resolve(root, file), "utf8"), /\p{Script=Cyrillic}/u, file);
  }
});
