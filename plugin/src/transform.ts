import MagicString from "magic-string";
import pLimit from "p-limit";
import { parseSource, resolveImports, findCallSites, computeCacheKey } from "@codespec/shared";
import { resolveEffectiveContext } from "./context-resolver.js";
import { generateCode } from "./generation.js";
import { applyRewrites, removeUnusedImports } from "./code-rewriter.js";
import type { CacheManager } from "./cache.js";
import type { ResolvedOptions, EnrichedCallSite } from "./types.js";

export interface ModuleTransformResult {
  code: string;
  map: ReturnType<MagicString["generateMap"]>;
}

const CONCURRENT_GENERATION_LIMIT = 4;

/** Stdlib subpath prefixes in both published and workspace forms. */
const STDLIB_SOURCES = new Set(["codespec-gen/stdlib", "@codespec/stdlib"]);

/**
 * Pre-resolve stdlib named imports to their absolute .codespec.md paths using
 * the plugin's `this.resolve()` (or any compatible async resolver).
 *
 * Returns a map from canonical subpath specifier to absolute file path so
 * that `resolveImports` can build deterministic `codespecMdPaths` entries.
 */
async function preResolveStdlibImports(
  code: string,
  filePath: string,
  resolveId: (id: string, importer: string) => Promise<{ id: string } | null>,
): Promise<Map<string, string>> {
  let ast;
  try {
    ast = parseSource(code, filePath);
  } catch {
    return new Map();
  }

  const resolved = new Map<string, string>();

  for (const node of ast.program.body) {
    if (node.type !== "ImportDeclaration") continue;
    const source = node.source.value;
    if (!STDLIB_SOURCES.has(source)) continue;

    for (const spec of node.specifiers) {
      if (spec.type !== "ImportSpecifier") continue;
      const imported =
        spec.imported.type === "Identifier"
          ? spec.imported.name
          : spec.imported.value;
      const subpath = `@codespec/stdlib/${imported}`;
      if (resolved.has(subpath)) continue;

      const result = await resolveId(subpath, filePath);
      if (result) {
        resolved.set(subpath, result.id);
      }
    }
  }

  return resolved;
}

/**
 * Transform a single JS/TS module:
 *  1. Parse AST, resolve CodeSpec bindings
 *  2. Find all call sites with lexical context
 *  3. Enrich each call site with effective context + cache key
 *  4. Resolve from cache or generate
 *  5. Rewrite source and remove unused imports
 *
 * @param resolveId - Optional async resolver (Vite's `this.resolve`). Required
 *   for stdlib imports to be resolved to `.codespec.md` bindings.
 */
export async function transformModule(
  code: string,
  filePath: string,
  opts: ResolvedOptions,
  cacheManager: CacheManager,
  codespecMdContent: Map<string, string>,
  resolveId?: (id: string, importer: string) => Promise<{ id: string } | null>,
): Promise<ModuleTransformResult | null> {
  // Pre-resolve stdlib subpath imports so resolveImports can map them to
  // absolute .codespec.md paths synchronously.
  const preResolved = resolveId
    ? await preResolveStdlibImports(code, filePath, resolveId)
    : new Map<string, string>();

  const resolveAbsolute = (specifier: string, _importer: string): string | null =>
    preResolved.get(specifier) ?? null;

  // Parse AST
  let ast;
  try {
    ast = parseSource(code, filePath);
  } catch (err) {
    if (opts.strict) {
      throw new Error(`CodeSpec: Failed to parse ${filePath}: ${String(err)}`);
    }
    return null;
  }

  // Resolve import bindings
  const { bindings, codespecMdPaths } = resolveImports(ast, filePath, resolveAbsolute);

  if (bindings.size === 0) return null;

  // Find all call sites
  const callSites = findCallSites(ast, bindings);
  if (callSites.length === 0) return null;

  const modelId = opts.provider.modelId ?? "unknown";
  const generationOptions = { temperature: 0 };

  // Enrich each call site with effective context and cache key
  const enriched: EnrichedCallSite[] = await Promise.all(
    callSites.map(async (site) => {
      const { effectiveContext, agentsMdContent } =
        await resolveEffectiveContext(site, filePath, opts);

      const instruction = site.args[0] ?? "";

      const cacheKey = await computeCacheKey({
        promptBlockType: site.type,
        instruction,
        args: site.args,
        effectiveContext,
        agentsMdContent,
        modelId,
        generationOptions,
      });

      return {
        ...site,
        effectiveContext,
        agentsMdContent,
        cacheKey,
      };
    }),
  );

  // Generate code for all non-context$ sites, respecting cache and concurrency
  const generatedCode = new Map<number, string>();
  const limit = pLimit(CONCURRENT_GENERATION_LIMIT);

  const warnings: string[] = [];

  await Promise.all(
    enriched.map((site) =>
      limit(async () => {
        if (site.type === "context$") return; // removed, no code needed

        // Check cache first
        const cached = await cacheManager.get(site.cacheKey);
        if (cached !== null) {
          generatedCode.set(site.callStart, cached);
          cacheManager.recordLookup(filePath, site.callStart, site.type, site.cacheKey);
          return;
        }

        // Cache miss
        if (opts.offline) {
          const msg = `CodeSpec: Cache miss in offline mode for ${site.type} at ${filePath}:${site.callStart}`;
          if (opts.strict) {
            throw new Error(msg);
          }
          warnings.push(msg);
          return;
        }

        // Generate
        const instruction = site.args[0] ?? "";
        const codespecContent =
          site.type === "codespec-md"
            ? codespecMdContent.get(codespecMdPaths.get(site.localName) ?? "")
            : undefined;

        let generated: string;
        try {
          generated = await generateCode({
            type: site.type,
            instruction,
            effectiveContext: site.effectiveContext,
            codespecMdContent: codespecContent,
            provider: opts.provider,
          });
        } catch (err) {
          const msg = `CodeSpec: Generation failed for ${site.type} at ${filePath}:${site.callStart} — ${String(err)}`;
          if (opts.strict) throw new Error(msg);
          warnings.push(msg);
          return;
        }

        // Persist to cache
        await cacheManager.set(site.cacheKey, generated, {
          cacheKey: site.cacheKey,
          promptBlockType: site.type,
          instruction,
          effectiveContext: site.effectiveContext,
          modelId,
          generationOptions,
        });
        cacheManager.recordLookup(filePath, site.callStart, site.type, site.cacheKey);

        generatedCode.set(site.callStart, generated);
      }),
    ),
  );

  for (const warn of warnings) {
    console.warn(warn);
  }

  // Determine which bindings are still needed after rewrite
  // (context$ and fully-replaced codespec-md bindings are no longer needed)
  const stillUsedBindings = new Set<string>();
  for (const site of enriched) {
    // A binding is "still used" if we couldn't transform it (no generated code)
    // and it's not context$ (which is always removed).
    if (site.type !== "context$" && !generatedCode.has(site.callStart)) {
      stillUsedBindings.add(site.localName);
    }
  }

  // Apply all rewrites
  const ms = new MagicString(code);
  applyRewrites(ms, enriched, generatedCode);
  removeUnusedImports(ms, ast, stillUsedBindings);

  return {
    code: ms.toString(),
    map: ms.generateMap({ hires: true, includeContent: true, source: filePath }),
  };
}
