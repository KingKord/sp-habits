// Rebuild from Unicode emoji-test.txt 16.0 and CLDR 46.1 Russian/English annotations.
// See THIRD_PARTY_LICENSES.txt. Inputs are explicit local files; no runtime requests.
import { readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const [emojiPath, labelsPath, englishPath] = process.argv.slice(2);
if (!emojiPath || !labelsPath || !englishPath)
  throw new Error("Pass emoji-test.txt, Russian annotations.json and English annotations.json");
const labels = JSON.parse(await readFile(labelsPath, "utf8")).annotations.annotations;
const english = JSON.parse(await readFile(englishPath, "utf8")).annotations.annotations;
const groups = [];
for (const line of (await readFile(emojiPath, "utf8")).split("\n")) {
  if (line.startsWith("# group: ")) groups.push([line.slice(9), []]);
  const match = line.match(/^([0-9A-F ]+)\s*; fully-qualified\s*# (\S+) E[0-9.]+ (.+)$/);
  if (
    !match ||
    match[1]
      .trim()
      .split(/\s+/)
      .some((code) => {
        const value = parseInt(code, 16);
        return value >= 0x1f3fb && value <= 0x1f3ff;
      })
  )
    continue;
  const emoji = match[2];
  const annotation = labels[emoji] ?? labels[emoji.replaceAll("\ufe0f", "")];
  const englishAnnotation = english[emoji] ?? english[emoji.replaceAll("\ufe0f", "")];
  const translated = annotation?.tts?.[0] ?? match[3];
  const name = englishAnnotation?.tts?.[0] ?? match[3];
  const keywords = [
    ...new Set([...(annotation?.default ?? []), ...(englishAnnotation?.default ?? []), match[3]])
  ]
    .filter((value) => value !== name)
    .join(" ");
  groups.at(-1)[1].push([emoji, name, keywords, translated]);
}
const json = JSON.stringify(groups.filter(([, entries]) => entries.length));
const compressed = gzipSync(json, { level: 9 }).toString("base64");
await writeFile(
  new URL("../src/i18n/emoji-data.js", import.meta.url),
  "// Generated from Unicode 16.0 / CLDR 46.1. See THIRD_PARTY_LICENSES.txt.\n" +
    "export const emojiData = " +
    JSON.stringify(compressed) +
    ";\n"
);
console.log(
  `${groups.reduce((sum, [, entries]) => sum + entries.length, 0)} emoji; ${Buffer.byteLength(json)} bytes JSON; ${compressed.length} bytes base64 gzip`
);
