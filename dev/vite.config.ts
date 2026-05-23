import { defineConfig } from "vite";
import { ollama } from "ai-sdk-ollama";
import { codeSpecPlugin } from "../plugin/src/index";

export default defineConfig({
  plugins: [
    ...codeSpecPlugin({
      provider: ollama("gemma4:e2b"),
    }),
  ],
});
