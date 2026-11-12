import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

// Real module resolution handles transitive imports, aliases and tree shaking.
export async function bundle(entryPoint, { includeMetadata = false } = {}) {
  const result = await build({
    absWorkingDir: root,
    entryPoints: [entryPoint],
    bundle: true,
    loader: { ".css": "text" },
    write: false,
    metafile: includeMetadata,
    format: "iife",
    platform: "browser",
    target: "es2022",
    charset: "utf8",
    minify: true,
    legalComments: "none"
  });
  const code = result.outputFiles[0].text;
  if (!includeMetadata) return code;
  const inputs = Object.values(result.metafile.outputs).flatMap((output) =>
    Object.entries(output.inputs).map(([path, value]) => ({ path, bytes: value.bytesInOutput }))
  );
  return { code, inputs: inputs.sort((a, b) => b.bytes - a.bytes) };
}
