import type { Plugin } from "vite";

export interface CodeSpecPluginOptions {
  banner?: string;
}

export function codeSpecPlugin(options: CodeSpecPluginOptions = {}): Plugin {
  const banner = options.banner ?? "CodeSpec dev website";

  return {
    name: "codespec-vite-plugin",
    transform(code, id) {
      if (!id.endsWith(".ts") && !id.endsWith(".tsx")) {
        return null;
      }

      if (!code.includes("__CODESPEC_BANNER__")) {
        return null;
      }

      return {
        code: code.replaceAll("__CODESPEC_BANNER__", banner),
        map: null
      };
    }
  };
}

export default codeSpecPlugin;
