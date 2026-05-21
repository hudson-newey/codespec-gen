import { defineConfig } from "vite";
import codeSpecPlugin from "@codespec/vite-plugin";

export default defineConfig({
  plugins: [codeSpecPlugin({ banner: "Injected by @codespec/vite-plugin" })]
});
