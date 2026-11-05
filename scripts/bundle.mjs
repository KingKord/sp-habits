import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

// Real module resolution handles transitive imports, aliases and tree shaking.
export async function bundle(entryPoint) {
  const result = await build({
    absWorkingDir: root,
    entryPoints: [entryPoint],
    bundle: true,
    loader: { ".css": "text" },
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2022",
    charset: "utf8",
    minify: true,
    legalComments: "none"
  });
  return result.outputFiles[0].text;
}
