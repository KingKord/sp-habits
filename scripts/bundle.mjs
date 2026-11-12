import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

// Real module resolution handles transitive imports, aliases and tree shaking.
export async function bundle(entryPoint, { includeMetadata = false, application } = {}) {
  const result = await build({
    absWorkingDir: root,
    entryPoints: [entryPoint],
    bundle: true,
    plugins: [
      {
        name: "offline-application",
        setup(plugin) {
          plugin.onResolve({ filter: /^habits:application$/ }, () => ({
            path: "application",
            namespace: "habits"
          }));
          plugin.onLoad({ filter: /^application$/, namespace: "habits" }, async () => {
            const source = application ?? (await bundle("src/app.js"));
            return {
              contents:
                "export default " +
                JSON.stringify(typeof source === "string" ? source : source.code) +
                ";",
              loader: "js"
            };
          });
        }
      }
    ],
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
