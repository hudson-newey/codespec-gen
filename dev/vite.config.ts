import { defineConfig } from "vite";
import { ollama } from "ai-sdk-ollama";
import codeSpecPlugin from "@codespec/vite-plugin";

export default defineConfig({
  plugins: [
    ...codeSpecPlugin({
      provider: ollama("gemma4"),
      offline: true, // Use committed artifacts only; no live generation calls in dev
    }),
  ],
});
