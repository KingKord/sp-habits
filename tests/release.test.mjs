import localizedFixture from "./fixtures/i18n/ru.json" with { type: "json" };
import test from "node:test";
import assert from "node:assert/strict";
import {
  validateReleaseVersion,
  readReleaseVersion,
  extractReleaseNotes
} from "../scripts/version.mjs";
import { planRelease, findRelease, createReleaseDraft } from "../scripts/release.mjs";

const commit = "a".repeat(40);
const other = "b".repeat(40);
const assets = ["sp-habits.zip", "sp-habits.zip.sha256"].map((name) => ({
  name,
  state: "uploaded"
}));
function versions(version = "1.2.3") {
  return [
    { version },
    { version, packages: { "": { version } } },
    { version },
    `<p>Habits · ${version}</p>`,
    `Current release: **${version}**`
  ];
}

test("release version matches the lock root, manifest, visible interface and current README", async () => {
  assert.equal(validateReleaseVersion(...versions()), "1.2.3");
  assert.match(await readReleaseVersion(), /^\d+\.\d+\.\d+$/);
  for (const index of [1, 2, 3, 4]) {
    const values = versions();
    if (index < 3) values[index].version = "1.2.4";
    else values[index] = values[index].replaceAll("1.2.3", "1.2.4");
    assert.throws(() => validateReleaseVersion(...values), /version differs/);
  }
  const values = versions();
  values[1].packages[""].version = "1.2.4";
  assert.throws(() => validateReleaseVersion(...values), /version differs/);
});

test("release tags accept stable versions and reject ambiguous or unsafe version strings", () => {
  for (const version of ["0.0.0", "0.15.1", "12.34.56"])
    assert.equal(validateReleaseVersion(...versions(version)), version);
  for (const version of [
    "01.2.3",
    "1.2",
    "v1.2.3",
    "1.2.3-beta",
    "1.2.3\n",
    "1.2.3\r",
    "1.2.3\ntag=oops",
    "1.2.3/other",
    "1.2.3+meta"
  ])
    assert.throws(() => validateReleaseVersion(...versions(version)), /stable X.Y.Z/);
});

test("a new release may create its tag or reuse an existing tag on the exact workflow commit", () => {
  assert.equal(planRelease(null, null, commit), "publish");
  assert.equal(planRelease(null, commit, commit), "publish");
  assert.throws(() => planRelease(null, other, commit), /different commit/);
});

test("a partial draft resumes only for its original commit, including annotated resolved tags", () => {
  const release = { draft: true, target_commitish: commit, assets: assets.slice(0, 1) };
  assert.equal(planRelease(release, null, commit), "publish");
  assert.equal(planRelease(release, commit, commit), "publish");
  assert.throws(
    () => planRelease(release, null, other),
    /Draft with assets targets a different commit/
  );
  assert.throws(
    () => planRelease(release, other, commit),
    /Existing tag points to a different commit/
  );
});

test("published releases remain immutable across repeated runs and pushes with an unchanged version", () => {
  const release = { draft: false, assets };
  assert.equal(planRelease(release, commit, commit), "skip");
  assert.equal(planRelease(release, commit, other), "skip");
  assert.throws(() => planRelease(release, null, commit), /has no tag/);
  for (const partial of [[], assets.slice(0, 1), [{ ...assets[0], state: "new" }, assets[1]]])
    assert.throws(() => planRelease({ ...release, assets: partial }, commit, commit), /missing/);
});

test("an empty untagged draft may follow a corrected workflow, but an existing tag cannot move", () => {
  const draft = { draft: true, target_commitish: commit, assets: [] };
  assert.equal(planRelease(draft, null, other), "retarget");
  assert.equal(planRelease(draft, commit, commit), "publish");
  assert.throws(
    () => planRelease(draft, commit, other),
    /Existing tag points to a different commit/
  );
});

test("release lookup finds drafts on later pages when the published-tag endpoint returns 404", () => {
  const draft = { id: 123, tag_name: "v1.2.3", draft: true };
  const calls = [];
  const result = findRelease("owner/repo", "v1.2.3", (args) => {
    calls.push(args);
    if (args[1].includes("/tags/")) {
      const error = new Error("not published");
      error.stderr = "gh: Not Found (HTTP 404)";
      throw error;
    }
    assert.deepEqual(args.slice(2), ["--paginate", "--slurp"]);
    return JSON.stringify([[{ tag_name: "v0.1.0", draft: false }], [draft]]);
  });
  assert.deepEqual(result, draft);
  assert.equal(calls.length, 2);
});

test("release lookup uses a published release directly and never hides network or permission errors", () => {
  const release = { tag_name: "v1.2.3", draft: false };
  let calls = 0;
  assert.deepEqual(
    findRelease("owner/repo", "v1.2.3", () => {
      calls++;
      return JSON.stringify(release);
    }),
    release
  );
  assert.equal(calls, 1);
  for (const stderr of [
    "TLS handshake timeout",
    "gh: Forbidden (HTTP 403)",
    "gh: Server Error (HTTP 500)"
  ])
    assert.throws(
      () =>
        findRelease("owner/repo", "v1.2.3", () => {
          const error = new Error(stderr);
          error.stderr = stderr;
          throw error;
        }),
      new RegExp(stderr.replace(/[()]/g, "\\$&"))
    );
});

test("release notes select the exact English changelog entry and reject missing or localized descriptions", () => {
  const changelog =
    "# Changelog\n\n## 1.2.3\n\n- English release notes.\n\n## 1.2.2\n\n- Previous notes.\n";
  assert.equal(extractReleaseNotes(changelog, "1.2.3"), "- English release notes.");
  assert.throws(() => extractReleaseNotes(changelog, "1.2.30"), /Missing changelog entry/);
  assert.throws(() => extractReleaseNotes("## 1.2.3\n\n", "1.2.3"), /must not be empty/);
  assert.throws(
    () => extractReleaseNotes("## 1.2.3\n\n" + localizedFixture.habitName, "1.2.3"),
    /must be in English/
  );
});

test("fresh draft creation uses the returned object without a second tag or list lookup", () => {
  const draft = { id: 123, draft: true, tag_name: "v1.2.3", target_commitish: commit, assets: [] };
  let calls = 0;
  const result = createReleaseDraft(
    "owner/repo",
    "v1.2.3",
    commit,
    "English release notes",
    (args) => {
      calls++;
      assert.deepEqual(args.slice(0, 4), ["api", "repos/owner/repo/releases", "--method", "POST"]);
      assert.ok(args.includes("tag_name=v1.2.3"));
      assert.ok(args.includes("target_commitish=" + commit));
      assert.ok(args.includes("draft=true"));
      assert.ok(args.includes("body=English release notes"));
      return JSON.stringify(draft);
    }
  );
  assert.deepEqual(result, draft);
  assert.equal(calls, 1);
});
