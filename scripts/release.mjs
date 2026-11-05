import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readReleaseVersion, readReleaseNotes } from "./version.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const files = ["sp-habits.zip", "sp-habits.zip.sha256"];
const hash = (data) => createHash("sha256").update(data).digest("hex");

// A published version is immutable, even when a later push keeps its version number.
export function planRelease(release, tagCommit, commit) {
  if (release && !release.draft) {
    assert.ok(tagCommit, "Published release has no tag");
    for (const name of files)
      assert.ok(
        release.assets.some((asset) => asset.name === name && asset.state === "uploaded"),
        `Published release is missing ${name}`
      );
    return "skip";
  }
  if (tagCommit)
    assert.equal(
      tagCommit,
      commit,
      "Existing tag points to a different commit; increase the version"
    );
  if (release && !tagCommit && release.target_commitish !== commit) {
    assert.equal(
      release.assets.length,
      0,
      "Draft with assets targets a different commit; rerun the original workflow"
    );
    return "retarget";
  }
  return "publish";
}

function gh(args) {
  return execFileSync("gh", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}
// Use the POST response directly: a new draft may not appear in list results yet.
export function createReleaseDraft(repo, tag, commit, body, run = gh) {
  const release = JSON.parse(
    run([
      "api",
      "repos/" + repo + "/releases",
      "--method",
      "POST",
      "--raw-field",
      "tag_name=" + tag,
      "--raw-field",
      "target_commitish=" + commit,
      "--raw-field",
      "name=Habits " + tag,
      "--raw-field",
      "body=" + body,
      "--field",
      "draft=true",
      "--field",
      "prerelease=false"
    ])
  );
  assert.ok(release?.draft && release.id, "Release draft was not created");
  assert.equal(release.tag_name, tag);
  assert.equal(release.target_commitish, commit);
  return release;
}
function api(endpoint, run = gh) {
  try {
    return JSON.parse(run(["api", endpoint]));
  } catch (error) {
    if (/\(HTTP 404\)/.test(String(error.stderr))) return null;
    throw error;
  }
}
// The tag endpoint only returns published releases. Drafts require the list API.
export function findRelease(repo, tag, run = gh) {
  const published = api(`repos/${repo}/releases/tags/${tag}`, run);
  if (published) return published;
  const pages = JSON.parse(
    run(["api", `repos/${repo}/releases?per_page=100`, "--paginate", "--slurp"])
  );
  return pages.flat().find((release) => release.tag_name === tag) ?? null;
}
function tagCommit(repo, tag) {
  let ref = api(`repos/${repo}/git/ref/tags/${tag}`)?.object;
  for (let i = 0; ref?.type === "tag" && i < 5; i++)
    ref = api(`repos/${repo}/git/tags/${ref.sha}`)?.object;
  if (!ref) return null;
  assert.equal(ref.type, "commit", "Release tag must resolve to a commit");
  return ref.sha;
}
async function checkArchive(dir, version) {
  const zip = join(dir, files[0]);
  const digest = hash(await readFile(zip));
  assert.equal(
    (await readFile(join(dir, files[1]), "utf8")).trim(),
    `${digest}  ${files[0]}`,
    "ZIP checksum mismatch"
  );
  execFileSync("unzip", ["-t", zip], { stdio: "pipe" });
  const manifest = JSON.parse(
    execFileSync("unzip", ["-p", zip, "manifest.json"], { encoding: "utf8" })
  );
  assert.equal(manifest.version, version, "ZIP version mismatch");
  return digest;
}
async function download(repo, tag, dir) {
  await mkdir(dir, { recursive: true });
  gh(["release", "download", tag, "--repo", repo, "--pattern", "sp-habits.zip*", "--dir", dir]);
}
async function summary(message) {
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, message + "\n");
}

async function publish() {
  assert.equal(process.env.GITHUB_ACTIONS, "true", "Run the release through GitHub Actions");
  assert.equal(process.env.GITHUB_REF, "refs/heads/main", "Only main can publish a release");
  assert.ok(
    ["push", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME),
    "Unsupported release event"
  );
  const repo = process.env.GITHUB_REPOSITORY;
  const commit = process.env.GITHUB_SHA;
  assert.match(repo, /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/);
  assert.match(commit, /^[a-f0-9]{40}$/);
  const version = await readReleaseVersion();
  const tag = `v${version}`;
  const dist = join(root, "dist");
  const digest = await checkArchive(dist, version);
  let release = findRelease(repo, tag);
  const plan = planRelease(release, tagCommit(repo, tag), commit);
  const temp = await mkdtemp(join(tmpdir(), "habit-release-"));
  try {
    if (plan === "skip") {
      const dir = join(temp, "published");
      await download(repo, tag, dir);
      await checkArchive(dir, version);
      await summary(
        `[${tag}](${release.html_url}) already exists and its ZIP/checksum are valid. Increase the version to publish a new release. Existing files were preserved.`
      );
      return;
    }
    const notes = join(temp, "notes.md");
    const description = await readReleaseNotes(version);
    await writeFile(
      notes,
      `Habits ${version}\n\n${description}\n\nInstall sp-habits.zip through Super Productivity Settings → Plugins (19.3.1+).\n\nChecks: npm run check (lint, formatting, tests, ZIP build).\nCommit: ${commit}\nWorkflow: https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}\nSHA-256: ${digest}\n`
    );
    if (!release) {
      release = createReleaseDraft(repo, tag, commit, await readFile(notes, "utf8"));
    } else if (plan === "retarget") {
      release = JSON.parse(
        gh([
          "api",
          "repos/" + repo + "/releases/" + release.id,
          "--method",
          "PATCH",
          "--raw-field",
          "target_commitish=" + commit,
          "--raw-field",
          "body=" + (await readFile(notes, "utf8"))
        ])
      );
      assert.equal(
        release.target_commitish,
        commit,
        "Empty draft was not updated to the workflow commit"
      );
    }
    for (const name of files) {
      if (release.assets.some((asset) => asset.name === name)) {
        const dir = join(temp, name);
        await mkdir(dir, { recursive: true });
        gh(["release", "download", tag, "--repo", repo, "--pattern", name, "--dir", dir]);
        assert.equal(
          hash(await readFile(join(dir, name))),
          hash(await readFile(join(dist, name))),
          `Existing draft asset differs: ${name}; files will not be overwritten`
        );
      } else gh(["release", "upload", tag, join(dist, name), "--repo", repo]);
    }
    const downloaded = join(temp, "verified");
    await download(repo, tag, downloaded);
    assert.equal(await checkArchive(downloaded, version), digest);
    release = JSON.parse(
      gh([
        "api",
        "repos/" + repo + "/releases/" + release.id,
        "--method",
        "PATCH",
        "--field",
        "draft=false"
      ])
    );
    assert.ok(release && !release.draft, "Release is still a draft");
    assert.equal(tagCommit(repo, tag), commit, "Published tag differs from the workflow commit");
    await summary(
      `Published [${tag}](${release.html_url}) from ${commit}. Both assets were downloaded and verified. SHA-256: ${digest}`
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  await publish();
