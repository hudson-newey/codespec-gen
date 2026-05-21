# Plan: Implement Full CodeSpec Vite Plugin

## TL;DR

Replace the stub `plugin/src/index.ts` with a full production Vite plugin that transforms `code$`, `guard$`, `context$`, `docs$`, and `.codespec.md` call sites into inline TypeScript using the Vercel AI SDK. Infrastructure (AST, cache key, AGENTS.md loading) lives in `shared/`; Vite-specific wiring, AI generation, and cache I/O live in `plugin/`.

## Phase 1 — Shared Infrastructure (`shared/src/`)

### 1a. AST Parser & Call-Site Finder

**File:** `shared/src/ast/parser.ts`

- Wrapper around `@babel/parser` (already installed) targeting TS + JSX via `parseSync`/`parse` with plugins: `typescript`, `importAssertions`
- Returns full `File` AST node

**File:** `shared/src/ast/import-resolver.ts`

- Walk the AST to collect all import declarations
- Detect `import { code$, guard$, context$, docs$ } from "codespec-gen"` — record local binding names for each specifier
- Detect `import X from "./foo.codespec.md"` — record as a codespec-md binding

**File:** `shared/src/ast/call-site-finder.ts`

- Walk the AST (using `estree-walker`) with scope tracking
- Identify call expressions whose callee is one of the resolved bindings (and is NOT shadowed)
- For each call site, record: function type (`code$`/`guard$`/`context$`/`docs$`/codespec-md), node start/end, string arguments, enclosing scope chain

### 1b. Lexical Context$ Scope Tracker

**File:** `shared/src/ast/scope-tracker.ts`

- During AST walk, maintain a scope stack
- On entering a scope (function/block), push a new frame
- Record each `context$` call with its arguments into the current scope frame
- On exiting a scope, pop frame
- For each non-context call site, compute the effective ordered context list (outer-to-inner, pre-call order)

### 1c. Cache Key Computation

**File:** `shared/src/cache/key.ts`

- Use `xxhash-wasm` (already installed) to compute a deterministic 64-bit hex hash
- Input to hash: JSON-serialized object containing { promptBlockId, normalizedInstruction, normalizedArgs, effectiveContext, agentsMdContent, modelId, generationOptions, schemaVersion }
- Export `computeCacheKey(input: CacheKeyInput): Promise<string>`

### 1d. Artifact Schema

**File:** `shared/src/cache/schema.ts`

- Zod schemas for:
  - `ArtifactMetadata`: { cacheKey, promptBlockType, instruction, context, modelId, generationOptions, pluginVersion, schemaVersion, generatedAt }
  - `ArtifactManifest`: record of cacheKey → artifactFileName
  - `ArtifactEntry`: { metadata: ArtifactMetadata, code: string }

### 1e. AGENTS.md Loader

**File:** `shared/src/context/agents-md.ts`

- Given a file path and project root, compute the ancestor directory chain using `path.relative`
- Use `fast-glob` (already installed) to discover `AGENTS.md` files in those ancestor dirs (root → nearest parent, inclusive)
- Read and concatenate them in root-to-nearest order
- Export `loadDirectoryContext(filePath: string, projectRoot: string): Promise<string[]>` — returns ordered array of AGENTS.md contents

### 1f. shared/src/index.ts Re-exports

Export all above utilities from the shared package public API.

---

## Phase 2 — Plugin Core (`plugin/src/`)

### 2a. Types & Config Interface

**File:** `plugin/src/types.ts`

- `CodeSpecPluginOptions`: provider (LanguageModelV1 from `ai`), cacheDir (default `codespec_gen`), strict (default false), include/exclude globs, offline (default false), defaultContext string[]
- `CallSiteInfo`: enriched call-site data with effective context, cache key, generated code
- `TransformResult`: { code: string, map: MagicString sourcemap }

### 2b. Context Resolver

**File:** `plugin/src/context-resolver.ts`

- Combines: plugin-level defaultContext → AGENTS.md directory context → lexical context$ entries
- Calls `loadDirectoryContext` from shared
- Returns ordered string[] of context entries for a given call site

### 2c. AI Generation Layer

**File:** `plugin/src/generation.ts`

- Uses `generateText` from `ai` package with `temperature: 0` (or lowest provider-supported value)
- System prompt per function type:
  - `code$`: "You are a TypeScript code generator. Output only the TypeScript expression that replaces the call site. No explanation, no markdown, no backticks."
  - `guard$`: "Output only the TypeScript validation statement(s). No explanation, no markdown, no backticks."
  - `docs$`: "Output only the JSDoc comment block. Start with `/**` and end with `*/`. No explanation."
  - `.codespec.md`: use codespec file content as system context
- User prompt = instruction + context entries
- Validate output is parseable TypeScript using `@babel/parser`
- Export `generateCode(type, instruction, context, provider): Promise<string>`

### 2d. Cache Manager

**File:** `plugin/src/cache.ts`

- `CacheManager` class with:
  - `constructor(cacheDir: string, projectRoot: string)`
  - `get(cacheKey: string): Promise<string | null>` — read artifact file
  - `set(cacheKey: string, code: string, metadata: ArtifactMetadata): Promise<void>` — atomic write using `write-file-atomic`
  - `loadManifest(): Promise<ArtifactManifest>` — reads/creates `manifest.json`
  - `saveManifest(manifest: ArtifactManifest): Promise<void>` — atomic write
  - `clear(): Promise<void>` — prune all artifacts
  - File naming: `${cacheKey.slice(0,8)}-${promptBlockId}.ts` (deterministic, filesystem-safe)

---

## Phase 3 — Transform Pipeline

### 3a. Code Rewriter

**File:** `plugin/src/code-rewriter.ts`

- Uses `magic-string` (in shared deps, available via @codespec/shared or add to plugin) for source transforms
- `rewriteCallSite(ms: MagicString, node, generatedCode: string, type: PromptBlockType)`:
  - `code$`: replace entire CallExpression node range with generatedCode
  - `guard$`: replace entire ExpressionStatement node range with generatedCode
  - `context$`: remove entire ExpressionStatement node range (including trailing semicolon)
  - `docs$`: remove the call + insert JSDoc comment before next declaration node
- `removeUnusedImports(ms: MagicString, importNodes, usedBindings: Set<string>)`
- Returns modified MagicString with source map

### 3b. Main Transform Orchestrator

**File:** `plugin/src/transform.ts`

- `transformModule(code, id, options, cacheManager): Promise<TransformResult | null>`:
  1. Parse AST via shared parser
  2. Resolve import bindings via import-resolver
  3. If no CodeSpec bindings found, return null (skip)
  4. Find all call sites via call-site-finder + scope-tracker
  5. For each call site (in parallel via `p-limit`):
     a. Resolve effective context via context-resolver
     b. Compute cache key
     c. Check cache/artifact (skip generation if hit)
     d. If cache miss and offline mode: emit warning, skip
     e. If cache miss: call generation layer
     f. Validate generated TypeScript is syntactically valid at target position
     g. Persist to cache
  6. Rewrite all call sites using code-rewriter (reverse order to preserve offsets)
  7. Remove now-unused CodeSpec imports
  8. Return `{ code: ms.toString(), map: ms.generateMap() }`

---

## Phase 4 — `.codespec.md` Support

### 4a. Virtual Module Loader

**File:** `plugin/src/codespec-md-loader.ts`

- `resolveId(id, importer)` hook: if id ends with `.codespec.md`, resolve to absolute path and mark as external to Vite's normal resolver
- `load(id)` hook: for `.codespec.md` files:
  1. Read the file content
  2. Parse YAML frontmatter (title, description, parameters if present)
  3. Return a TypeScript stub module:
     ```ts
     // __codespec_md__::/abs/path/to/file.codespec.md
     export default function __codespec_stub__(
       args?: Record<string, unknown>,
     ): never {
       throw new Error("CodeSpec not compiled");
     }
     ```
  4. Store file content in a module-keyed map for transform-time lookup
- The special comment allows the transform step to identify this as a codespec-md call and look up the instructions

### 4b. Codespec.md → Generation Prompt

**File:** `plugin/src/transform.ts` (extended)

- When a call site uses a codespec-md binding, look up the stored content from the loader map
- Use the codespec file's full markdown content as additional system context
- Pass the call arguments as user-facing inputs to the generation prompt

---

## Phase 5 — Plugin Wiring

### 5a. Plugin Entry Point Rewrite

**File:** `plugin/src/index.ts` — full rewrite

- `codeSpecPlugin(options: CodeSpecPluginOptions): Plugin[]` returning array of plugins (including codespec-md loader plugin + transform plugin)
- Hooks implemented: `configResolved` (capture project root), `resolveId`, `load`, `transform`
- Initialize `CacheManager` in `buildStart` hook
- In `transform`: call `transformModule` for `.js`, `.mjs`, `.cjs`, `.ts`, `.mts`, `.cts` files (filtered by include/exclude globs using `picomatch`)

### 5b. Dev Mode / HMR

- In `handleHotUpdate`: invalidate transform cache for changed modules that contain CodeSpec calls
- Cache artifacts in `codespec_gen` are NOT invalidated on HMR (only changed keys miss); unchanged call sites reuse artifacts

### 5c. Production Build

- `generateBundle` hook: verify no unresolved call sites remain (strict mode: error, lenient: warn)
- Log summary of generation calls vs cache hits

---

## Relevant Files

- `plugin/src/index.ts` — full rewrite (plugin factory)
- `plugin/src/types.ts` — new (config + internal types)
- `plugin/src/transform.ts` — new (orchestrator)
- `plugin/src/generation.ts` — new (AI SDK)
- `plugin/src/cache.ts` — new (artifact cache)
- `plugin/src/context-resolver.ts` — new
- `plugin/src/code-rewriter.ts` — new
- `plugin/src/codespec-md-loader.ts` — new
- `shared/src/index.ts` — fill in re-exports
- `shared/src/ast/parser.ts` — new
- `shared/src/ast/import-resolver.ts` — new
- `shared/src/ast/call-site-finder.ts` — new
- `shared/src/ast/scope-tracker.ts` — new
- `shared/src/cache/key.ts` — new
- `shared/src/cache/schema.ts` — new
- `shared/src/context/agents-md.ts` — new
- `plugin/package.json` — may need `magic-string` added (currently only in shared)

---

## Verification

1. `pnpm build` succeeds with zero type errors across `shared` and `plugin`
2. Run `pnpm dev` (dev-site) — `dev/src/main.ts` with `code$` call is transformed; browser shows generated output
3. Confirm `codespec_gen/` directory is created and contains `.ts` artifact files + `manifest.json`
4. Change prompt text → artifact regenerated (cache miss); revert → artifact reused (cache hit)
5. Add root `AGENTS.md` → its content appears in effective context used for generation
6. Import a `.codespec.md` file in dev/src/main.ts → call is transformed correctly
7. Set `offline: true` → no generation calls; warns for cache misses; existing artifacts reused
8. Set `strict: true` with a dynamic non-resolvable call site → build fails with actionable error

---

## Decisions

- AST infrastructure lives in `shared/` (already has `@babel/parser`, `estree-walker`, `magic-string`)
- AI generation and Vite wiring live in `plugin/` (already has `ai`, AI SDK providers)
- `magic-string` is in `shared/package.json` deps; plugin will access it through shared or it may need to be added to plugin deps directly
- `context$` calls are removed entirely from output (compile-time only)
- `.codespec.md` virtual modules use a stub export; the transform identifies the stub and performs the real rewrite
- Cache key schema version = `"1"` (bump on breaking changes)
- Default temperature = `0` for all providers (spec: lowest supported value)

## Out of Scope

- VS Code extension implementation
- Runtime library (`codespec-gen` npm package types/stubs for end-user imports)
- Formatter/linter post-processors
- Parallel generation scheduling with rate-limit awareness
