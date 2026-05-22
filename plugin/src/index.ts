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
 * Transforms `.codespec.md` imports and `context$` calls into inline
 * TypeScript at build time using the configured LLM provider. Import stdlib
 * helpers from `codespec-gen/stdlib` and the context helper from
 * `codespec-gen/context`.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from "vite";
 * import { openai } from "@ai-sdk/openai";
 * import { codeSpecPlugin } from "@codespec/vite-plugin";
 *
 * export default defineConfig({
 *   plugins: [
 *     ...codeSpecPlugin({ provider: openai("gpt-4o") }),
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

      cacheManager = new CacheManager(cacheDir, projectRoot);
    },
  };

  const loaderPlugin = createCodespecMdPlugin(registry);

  const transformPlugin: Plugin = {
    name: "codespec-transform",

    async buildStart() {
      await cacheManager.init();
    },

    // Normalize published `@codespec/*` imports to `codespec-gen/*` aliases,
    // and delegate `.codespec.md` resolution to the loader plugin.
    async resolveId(id, importer, opts) {
      if (id === "@codespec/context") {
        return this.resolve("codespec-gen/context", importer, opts);
      }
      if (id === "@codespec/stdlib") {
        return this.resolve("codespec-gen/stdlib", importer, opts);
      }
      if (id.startsWith("@codespec/stdlib/")) {
        const subpath = id.slice("@codespec/stdlib/".length);
        return this.resolve(`codespec-gen/stdlib/${subpath}`, importer, opts);
      }

      if (id === "codespec-gen/context") {
        return this.resolve("@codespec/context", importer, opts);
      }
      if (id === "codespec-gen/stdlib") {
        return this.resolve("@codespec/stdlib", importer, opts);
      }
      if (id.startsWith("codespec-gen/stdlib/")) {
        const subpath = id.slice("codespec-gen/stdlib/".length);
        return this.resolve(`@codespec/stdlib/${subpath}`, importer, opts);
      }

      // Delegate .codespec.md resolution to the loader plugin
      if (loaderPlugin.resolveId) {
        return (loaderPlugin.resolveId as Function).call(this, id, importer, opts);
      }
      return null;
    },

    load: loaderPlugin.load,

    async transform(code, id) {
      const cleanId = id.split("?")[0]!;
      const filter = createFilter(resolvedOpts.include, resolvedOpts.exclude);

      if (!filter(cleanId)) return null;
      if (cleanId.endsWith(".codespec.md")) return null;

      // Bind this.resolve so transformModule can pre-resolve stdlib imports
      // to their absolute .codespec.md paths.
      const resolveId = async (
        specifier: string,
        importer: string,
      ): Promise<{ id: string } | null> => {
        const result = await this.resolve(specifier, importer);
        return result ?? null;
      };

      // Pre-load any .codespec.md imports into the registry BEFORE calling
      // transformModule. Vite's load hook (which populates the registry) only
      // fires after the current transform returns and the browser/bundler
      // discovers the import — too late. Forcing this.load() here ensures the
      // registry has content when transformModule needs it.
      for (const match of code.matchAll(
        /from\s+['"]([^'"]*\.codespec\.md)['"]/g,
      )) {
        const specifier = match[1]!;
        const resolved = await this.resolve(specifier, cleanId);
        if (resolved) {
          const absId = resolved.id.split("?")[0]!;
          if (registry.get(absId) === undefined) {
            await this.load({ id: resolved.id });
          }
        }
      }

      try {
        const result = await transformModule(
          code,
          cleanId,
          resolvedOpts,
          cacheManager,
          registry.asMap(),
          resolveId,
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

    async closeBundle() {
      await cacheManager.saveLookup();
    },
  };

  return [configPlugin, transformPlugin];
}

