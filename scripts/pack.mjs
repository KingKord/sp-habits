import {
  readFile,
  writeFile,
  appendFile,
  mkdir,
  copyFile,
  rm,
  chmod,
  utimes
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import { bundle } from "./bundle.mjs";
import { readReleaseVersion } from "./version.mjs";
import { iframeBudget, assertIframeBudget } from "./iframe-budget.mjs";
import { MAX_APPLICATION_CHARACTERS } from "../src/host/protocol.js";

await readReleaseVersion();

const root = fileURLToPath(new URL("../", import.meta.url));
const dir = path.join(root, "dist/plugin");
await mkdir(dir, { recursive: true });
const read = (name) => readFile(path.join(root, "src", name), "utf8");
const manifest = JSON.parse(await read("manifest.json"));
if (!manifest.iFrame || manifest.id !== "sp-habit-limits") throw new Error("Invalid manifest");
const [application, loader] = await Promise.all([
  bundle("src/app.js", { includeMetadata: true }),
  bundle("src/loader.js", { includeMetadata: true })
]);
const host = await bundle("src/plugin.js", { includeMetadata: true, application });
const script = loader.code,
  hostScript = host.code;
new vm.Script(application.code);
if (application.code.length > MAX_APPLICATION_CHARACTERS)
  throw new Error("The application exceeds the offline loader resource limit");
if (Buffer.byteLength(hostScript) > 10 * 1024 * 1024)
  throw new Error("plugin.js exceeds the 10 MiB bundled resource limit");
new vm.Script(script);
new vm.Script(hostScript);
const html = (await read("index.html"))
  .replace(/>\s+</g, "><")
  .trim()
  .replace("/* INLINE_SCRIPT */", () => script.replace(/<\/script/gi, "<\\/script"));
const report = {
  ...iframeBudget(Buffer.byteLength(html)),
  loader: loader.inputs,
  applicationBytes: Buffer.byteLength(application.code),
  hostBytes: Buffer.byteLength(hostScript),
  application: application.inputs,
  host: host.inputs
};
await writeFile(path.join(root, "dist/build-budget.json"), JSON.stringify(report, null, 2) + "\n");
const budgetText =
  "Iframe: " +
  report.bytes +
  " / " +
  report.limit +
  " bytes; headroom: " +
  report.remaining +
  "; delta from " +
  report.baseline.version +
  ": " +
  (report.delta >= 0 ? "+" : "") +
  report.delta +
  " bytes.";
console.log(budgetText);
if (process.env.GITHUB_STEP_SUMMARY)
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    "### Habits iframe budget\n\n" +
      budgetText +
      "\n\nLargest application contributors:\n" +
      report.application
        .slice(0, 8)
        .map((item) => "- " + item.path + ": " + item.bytes + " bytes")
        .join("\n") +
      "\n"
  );
if (report.warning)
  console.warn(
    (process.env.GITHUB_ACTIONS ? "::warning file=src/index.html::" : "Warning: ") +
      "Iframe is at least 95 KiB. Review dist/build-budget.json before adding UI code."
  );
assertIframeBudget(report);
if (html.includes("INLINE_")) throw new Error("Unresolved build token");
await writeFile(path.join(dir, "index.html"), html);
await writeFile(path.join(dir, "plugin.js"), hostScript);
for (const name of ["manifest.json", "icon.svg"])
  await copyFile(path.join(root, "src", name), path.join(dir, name));
await copyFile(
  path.join(root, "THIRD_PARTY_LICENSES.txt"),
  path.join(dir, "THIRD_PARTY_LICENSES.txt")
);
await copyFile(path.join(root, "LICENSE"), path.join(dir, "LICENSE"));
// Fixed timestamps, permissions and timezone make retries produce identical ZIPs.
const archiveFiles = [
  "manifest.json",
  "index.html",
  "icon.svg",
  "plugin.js",
  "THIRD_PARTY_LICENSES.txt",
  "LICENSE"
];
const timestamp = new Date("2000-01-01T00:00:00Z");
for (const file of archiveFiles) {
  await chmod(path.join(dir, file), 0o644);
  await utimes(path.join(dir, file), timestamp, timestamp);
}
const zipPath = path.join(root, "dist/sp-habits.zip");
await rm(zipPath, { force: true });
execFileSync("zip", ["-q", "-X", zipPath, ...archiveFiles], {
  cwd: dir,
  env: { ...process.env, TZ: "UTC" }
});
execFileSync("unzip", ["-t", zipPath]);
const digest = createHash("sha256")
  .update(await readFile(zipPath))
  .digest("hex");
await writeFile(zipPath + ".sha256", digest + "  sp-habits.zip\n");
console.log(zipPath + "\nindex.html: " + Buffer.byteLength(html) + " bytes\nSHA-256: " + digest);
