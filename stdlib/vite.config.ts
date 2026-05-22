import { cpSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import dts from "vite-plugin-dts";

function copyCodespecAssets(): Plugin {
  return {
    name: "copy-codespec-assets",
    closeBundle() {
      const specs = ["code$.codespec.md", "guard$.codespec.md", "docs$.codespec.md"];
      for (const spec of specs) {
        cpSync(resolve(__dirname, "src", spec), resolve(__dirname, "dist", spec));
      }
    },
  };
}

export default defineConfig({
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: [/\.codespec\.md$/],
    },
  },
  plugins: [
    dts({
      entryRoot: "src",
      outDir: "dist",
      tsconfigPath: resolve(__dirname, "tsconfig.json"),
      include: ["src/**/*.ts"],
    }),
    copyCodespecAssets(),
  ],
});
