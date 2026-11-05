import { readFile, writeFile, mkdir, copyFile, rm, chmod, utimes } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import { bundle } from "./bundle.mjs";
import { readReleaseVersion } from "./version.mjs";

await readReleaseVersion();

const root = fileURLToPath(new URL("../", import.meta.url));
const dir = path.join(root, "dist/plugin");
await mkdir(dir, { recursive: true });
const read = (name) => readFile(path.join(root, "src", name), "utf8");
const manifest = JSON.parse(await read("manifest.json"));
if (!manifest.iFrame || manifest.id !== "sp-habit-limits") throw new Error("Invalid manifest");
const [script, hostScript] = await Promise.all([bundle("src/app.js"), bundle("src/plugin.js")]);
new vm.Script(script);
new vm.Script(hostScript);
const html = (await read("index.html"))
  .replace(/>\s+</g, "><")
  .trim()
  .replace("/* INLINE_SCRIPT */", () => script.replace(/<\/script/gi, "<\\/script"));
if (Buffer.byteLength(html) >= 100 * 1024)
  throw new Error("index.html exceeds host's 100 KiB limit");
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
