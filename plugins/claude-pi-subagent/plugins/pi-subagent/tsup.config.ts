import { defineConfig } from "tsup";

// Bundle the MCP server into a single, dependency-free ESM file
// (dist/server.mjs) so the plugin runs with bare `node` after install —
// no `npm install` step required on the user's machine.
export default defineConfig({
  entry: { server: "src/server.ts" },
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  outExtension: () => ({ js: ".mjs" }),
  bundle: true,
  noExternal: [/.*/], // inline every non-builtin dependency
  splitting: false,
  treeshake: true,
  clean: true,
  sourcemap: false,
  minify: false,
  dts: false,
  shims: false,
});
