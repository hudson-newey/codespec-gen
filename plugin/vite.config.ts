import { resolve } from "node:path";
import { builtinModules } from "node:module";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const nodeExternals = [
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
];

const packageExternals = [
  "ai",
  "@ai-sdk/anthropic",
  "@ai-sdk/openai",
  "@ai-sdk/provider",
  "ai-sdk-ollama",
  "log-update",
  "magic-string",
  "p-limit",
  "write-file-atomic",
];

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
      external: ["vite", ...nodeExternals, ...packageExternals],
    },
  },
  plugins: [
    dts({
      entryRoot: "src",
      outDir: "dist",
      tsconfigPath: resolve(__dirname, "tsconfig.json"),
      include: ["src/**/*.ts"],
    }),
  ],
});
