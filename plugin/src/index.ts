import type { Plugin, ResolvedConfig } from "vite";
import * as path from "node:path";
import { createFilter } from "vite";
import type { CodeSpecPluginOptions, ResolvedOptions } from "./types.js";
import { CacheManager } from "./cache.js";
import { transformModule } from "./transform.js";
import {
  CodespecMdRegistry,
  createCodespecMdPlugin,
} from "./codespec-md-loader.js";

export type { CodeSpecPluginOptions } from "./types.js";

const DEFAULT_INCLUDE = [
  "**/*.js",
  "**/*.mjs",
  "**/*.cjs",
  "**/*.ts",
  "**/*.mts",
  "**/*.cts",
];

const DEFAULT_EXCLUDE = ["node_modules/**", "codespec_gen/**"];

/**
 * CodeSpec Vite plugin.
 *
 * Transforms `code$`, `guard$`, `context$`, `docs$`, and local `.codespec.md`
 * imports into inline TypeScript at build time using the configured LLM provider.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from "vite";
 * import { openai } from "@ai-sdk/openai";
 * import CodeSpec from "@codespec/vite-plugin";
 *
 * export default defineConfig({
 *   plugins: [
 *     CodeSpec({ provider: openai("gpt-4o") }),
 *   ],
 * });
 * ```
 */
export function codeSpecPlugin(options: CodeSpecPluginOptions): Plugin[] {
  let resolvedOpts: ResolvedOptions;
  let cacheManager: CacheManager;
  const registry = new CodespecMdRegistry();

  const configPlugin: Plugin = {
    name: "codespec-config",
    configResolved(config: ResolvedConfig) {
      const projectRoot = config.root;
      const cacheDir = path.resolve(
        projectRoot,
        options.cacheDir ?? "codespec_gen",
      );

      resolvedOpts = {
        provider: options.provider,
        cacheDir,
        strict: options.strict ?? false,
        include: options.include ?? DEFAULT_INCLUDE,
        exclude: options.exclude ?? DEFAULT_EXCLUDE,
        offline: options.offline ?? false,
        defaultContext: options.defaultContext ?? [],
        projectRoot,
      };

      cacheManager = new CacheManager(cacheDir);
    },
  };

  const loaderPlugin = createCodespecMdPlugin(registry);

  const transformPlugin: Plugin = {
    name: "codespec-transform",

    async buildStart() {
      await cacheManager.init();
    },

    resolveId: loaderPlugin.resolveId,
    load: loaderPlugin.load,

    async transform(code, id) {
      const cleanId = id.split("?")[0]!;
      const filter = createFilter(resolvedOpts.include, resolvedOpts.exclude);

      if (!filter(cleanId)) return null;
      if (cleanId.endsWith(".codespec.md")) return null;

      try {
        const result = await transformModule(
          code,
          cleanId,
          resolvedOpts,
          cacheManager,
          registry.asMap(),
        );
        if (!result) return null;
        // MagicString SourceMap is structurally compatible with Vite's
        // ExistingRawSourceMap. Cast to satisfy the Rollup/Vite type system.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return { code: result.code, map: result.map as any };
      } catch (err) {
        const message = `CodeSpec transform error in ${cleanId}: ${String(err)}`;
        if (resolvedOpts.strict) {
          this.error(message);
        } else {
          this.warn(message);
        }
        return null;
      }
    },
  };

  return [configPlugin, transformPlugin];
}

export default codeSpecPlugin;

