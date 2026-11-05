import assert from "node:assert/strict";
import { appendFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

export function validateReleaseVersion(pkg, lock, manifest, html, readme) {
  const version = pkg.version;
  assert.equal(version, version.trim(), "Use a stable X.Y.Z version");
  assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, "Use a stable X.Y.Z version");
  for (const [name, value] of [
    ["package-lock.json", lock.version],
    ["package-lock.json packages root", lock.packages?.[""]?.version],
    ["src/manifest.json", manifest.version]
  ])
    assert.equal(value, version, `${name} version differs from package.json`);
  assert.ok(
    html.includes(`Habits · ${version}</p>`),
    "Interface version differs from package.json"
  );
  assert.ok(
    readme.includes(`Current release: **${version}**`),
    "README version differs from package.json"
  );
  return version;
}

export function extractReleaseNotes(changelog, version) {
  const lines = changelog.split("\n");
  const start = lines.indexOf("## " + version);
  assert.ok(start >= 0, "Missing changelog entry for " + version);
  let end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  if (end < 0) end = lines.length;
  const notes = lines
    .slice(start + 1, end)
    .join("\n")
    .trim();
  assert.ok(notes, "Release notes must not be empty");
  assert.doesNotMatch(notes, /\p{Script=Cyrillic}/u, "Release notes must be in English");
  return notes;
}

export async function readReleaseNotes(version) {
  return extractReleaseNotes(await readFile(resolve(root, "CHANGELOG.md"), "utf8"), version);
}

export async function readReleaseVersion() {
  const files = await Promise.all(
    ["package.json", "package-lock.json", "src/manifest.json", "src/index.html", "README.md"].map(
      (name) => readFile(resolve(root, name), "utf8")
    )
  );
  const version = validateReleaseVersion(...files.slice(0, 3).map(JSON.parse), ...files.slice(3));
  await readReleaseNotes(version);
  return version;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const version = await readReleaseVersion();
  console.log(version);
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, `version=${version}\ntag=v${version}\n`);
}
