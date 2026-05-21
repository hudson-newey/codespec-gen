import { defineConfig } from "tsup";
import { cpSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  outDir: "dist",
  // Mark .codespec.md imports as external — they are resolved by the
  // CodeSpec Vite plugin at consumer build time, not bundled here.
  external: [/\.codespec\.md$/],
  async onSuccess() {
    // Copy .codespec.md spec files alongside the compiled output so that
    // consumer bundlers can resolve them relative to dist/index.js.
    const specs = [
      "code$.codespec.md",
      "guard$.codespec.md",
      "docs$.codespec.md",
    ];
    for (const spec of specs) {
      cpSync(resolve("src", spec), resolve("dist", spec));
    }
  },
});
