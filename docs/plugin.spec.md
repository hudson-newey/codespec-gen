# CodeSpec Vite Plugin Specification

The CodeSpec Vite plugin compiles CodeSpec prompt block calls into concrete source code during Vite transforms.

When a file imports and invokes a supported CodeSpec function (for example `code$`, `guard$`, `context$`, or `docs$`), the plugin resolves the effective prompt input at build time, generates output through the configured model/provider, and rewrites the module so generated code is inlined at the call site.

Supported imports include both built-in prompt block functions and user-authored local custom CodeSpec files (for example `./my-helper.codespec.md`) that are imported into JavaScript/TypeScript modules.

To avoid duplicate generation work, the plugin caches outputs using a deterministic key derived from the prompt input, invocation arguments, model settings, and effective context.

Generated artifacts must also be materialized to a local `codespec_gen` directory at the project root so they can be committed and reused across developers/devices.

## Purpose

The plugin exists to make CodeSpec compile-time generation practical in normal Vite workflows by:

- transforming prompt block calls into regular JavaScript/TypeScript source,
- eliminating manual copy/paste from external LLM tools,
- making generated output reproducible for stable builds,
- reducing generation costs through cache reuse.

## Scope

In scope:

- Vite plugin lifecycle behavior for CodeSpec transforms,
- call-site discovery and rewrite semantics,
- support for local custom CodeSpec file imports,
- cache key and cache lifecycle semantics,
- generated artifact persistence under project root,
- source map and diagnostics behavior,
- development and production build behavior.

Out of scope:

- Authoring format of `.codespec.md` files (see [CodeSpec Spec](./codespec.spec.md)),
- built-in prompt block APIs (see [CodeSpec Standard Library Spec](./stdlib.spec.md)),
- editor UX concerns such as preview/inline buttons (see [VS Code Extension Spec](./vscode-extension.spec.md)).

## Terminology

- Prompt block call: A call expression to a supported CodeSpec function.
- Effective context: The merged context visible at a call site (for example local `context$` calls, imported context strings, and plugin-level defaults).
- Generated payload: The model output returned for a prompt block call.
- Inline rewrite: AST-backed source rewrite replacing a prompt block call with generated code.

## Supported Inputs

The plugin must support JavaScript and TypeScript module transforms in Vite for at least:

- `.js`, `.mjs`, `.cjs`,
- `.ts`, `.mts`, `.cts`,
- optional framework wrappers that pass through Vite JS/TS transforms (for example script blocks compiled to JS/TS before plugin execution).

## Prompt Block Discovery

The plugin must discover prompt block calls by analyzing module AST, not by raw string replacement.

Discovery rules:

1. Function calls that resolve to recognized CodeSpec imports are transformed, including local custom `.codespec.md` imports and built-in prompt block imports.
2. Locally shadowed identifiers must not be transformed.
3. Re-exported aliases must be resolved where statically possible.
4. Unsupported dynamic patterns (for example computed callee expressions that cannot be resolved statically) are left unchanged and may emit a warning.

## Transformation Pipeline

For each transformed module:

1. Parse module source and build import/call-site map.
2. Resolve supported prompt block call sites.
3. Compute effective context for each call site.
4. Normalize prompt input and invocation arguments.
5. Resolve cache key.
6. If cache hit: reuse generated payload.
7. If cache miss: call provider/model and persist payload.
8. Rewrite call expression with generated code.
9. Remove now-unused CodeSpec imports where safe.
10. Emit transformed code plus source map.

## Generation Semantics

1. Generation occurs at build/transform time, never at runtime.
2. For identical normalized inputs and settings, generation should be deterministic when provider settings allow deterministic output.
3. The plugin must request generation with the lowest temperature value supported by the configured model/provider.
4. If a provider does not expose temperature, the plugin must use the most deterministic equivalent setting available.
5. Generated output must be TypeScript.
6. Generated TypeScript must be valid in the local syntactic position of the original call site (expression, statement, declaration context as applicable).
7. If a generated payload is not TypeScript or is syntactically invalid for the target context, transform must fail with a clear error.

## Context Resolution

Effective context must be computed in a predictable order.

Recommended precedence (lowest to highest):

1. Plugin/global default context.
2. File-level context derived from statically analyzable declarations/imported strings.
3. Lexically nearest `context$` calls in active scope.
4. Explicit call-site arguments (if supported by the prompt block).

When context cannot be fully resolved statically, the plugin should either:

- emit a diagnostic and skip transforming that call site, or
- fail the build in strict mode.

## Caching

The plugin must cache generated payloads to avoid repeated provider calls.

The default cache/artifact location must be the project-root `codespec_gen` directory.

### Cache Key Inputs

Cache key must include, at minimum:

- prompt block identifier,
- normalized prompt/instruction text,
- normalized invocation arguments,
- resolved effective context,
- model/provider identifier,
- relevant generation options (temperature, max tokens, etc.),
- plugin/compiler version (or cache schema version).

### Cache Behavior

1. Equal cache keys must return identical cached payloads.
2. Cache misses must trigger generation and persist results.
3. Cache invalidation must occur when key inputs change.
4. Plugin should support explicit cache clearing.
5. Corrupted cache entries must fail gracefully and regenerate.

### Persistent Generated Artifact Directory

The plugin must persist generation artifacts under a local directory named `codespec_gen` at the repository root.

Requirements:

1. The directory path must resolve as `<projectRoot>/codespec_gen` by default.
2. The directory must be created automatically when missing.
3. Persisted artifacts must include enough metadata to validate cache keys and regenerate when inputs change.
4. File naming must be deterministic and safe for cross-platform filesystems.
5. Artifact writes should be atomic to avoid partial/corrupt files during interrupted builds.
6. Artifacts must be stable so they can be committed to source control.
7. Existing valid artifacts in `codespec_gen` must be reused before calling the provider.
8. The plugin should support optional cleanup/pruning of stale artifacts.
9. Persisted generated payload artifacts must be TypeScript files.

Recommended contents:

- generated payload files,
- index/manifest mapping cache keys to artifact files,
- optional metadata for plugin version and schema version.

## Development and Build Modes

### Dev Server

- Transforms run on module load/update.
- HMR updates should re-transform only affected modules.
- Cached payloads should be reused across edits when keys match.
- Persisted artifacts in `codespec_gen` should be updated only for changed keys.

### Production Build

- Transforms must run for the full module graph included in the final bundle.
- Build output must not contain unresolved compile-time prompt block calls.
- Build should reuse and update `codespec_gen` artifacts so CI and local builds converge on the same committed generation state.

## Source Maps and Diagnostics

1. The plugin must emit source maps that preserve debuggability for transformed modules.
2. Diagnostics must include file path and approximate location of the failing call site.
3. Provider failures (timeout, auth, quota, network) must surface clear actionable errors.
4. Syntax/compatibility failures in generated code must reference both call site and generation context.

## Configuration

The plugin should expose configuration for:

- provider/model selection,
- generation options (default temperature must be set to the lowest provider-supported value),
- cache directory/location (default: `<projectRoot>/codespec_gen`),
- strict vs lenient failure behavior,
- include/exclude glob patterns for transform scope,
- optional offline mode (cache-only, no generation calls).

Default behavior should require no extra configuration for repository-committed artifacts.

Configuration should be serializable and stable in CI environments.

## Security and Privacy

1. Only data required for generation should be sent to providers.
2. Secrets (API keys, tokens) must be read from secure configuration and never embedded into transformed output.
3. The plugin should provide redaction hooks or guidance for sensitive context.
4. Cache storage should avoid leaking secrets in plain text when avoidable.
5. The `codespec_gen` directory should contain only generation artifacts/metadata and no raw credentials.

## Functional Requirements

1. The plugin must detect and transform supported CodeSpec prompt block calls in JS/TS modules.
2. The plugin must support user-authored local custom CodeSpec file imports (for example `./feature.codespec.md`) as transformable CodeSpec sources.
3. The plugin must inline generated payloads at each transformed call site.
4. The plugin must compute effective context deterministically.
5. The plugin must cache generation outputs using deterministic keys.
6. The plugin must persist generated artifacts to `<projectRoot>/codespec_gen` by default.
7. The plugin must prefer existing valid artifacts from `codespec_gen` before requesting new generation.
8. The plugin must ensure persisted artifacts are deterministic and suitable for source control commits.
9. The plugin must skip or fail unsupported dynamic call sites according to configured mode.
10. The plugin must remove now-unused CodeSpec imports when safe.
11. The plugin must emit transformed code and source maps.
12. The plugin must produce actionable diagnostics for generation/transform failures.
13. The plugin must reject non-TypeScript generation outputs.
14. The plugin must use the lowest provider-supported temperature (or deterministic equivalent) for generation requests.

## Non-Functional Requirements

1. Cold transform performance should be acceptable for typical module sizes.
2. Warm-cache transforms should be significantly faster than cold generation.
3. Cache behavior must be reproducible in local and CI builds.
4. The plugin should avoid unnecessary provider calls during incremental rebuilds.
5. `codespec_gen` artifacts should produce minimal diff churn for identical inputs.
6. Default generation settings should prioritize determinism over creativity to maximize reproducible builds.

## Acceptance Criteria

1. Given a module containing supported prompt block imports and calls, build output contains inlined generated code at those call sites.
2. Running the same build twice with unchanged inputs reuses cached payloads and does not trigger duplicate generation calls.
3. After generation, artifacts are present in `<projectRoot>/codespec_gen` and are stable enough to commit.
4. Changing prompt text, arguments, context, model, or generation options causes cache miss and regeneration.
5. If provider access fails, build/dev output shows a clear error with file and call-site context.
6. In strict mode, unresolved dynamic prompt block calls fail the build.
7. In lenient mode, unresolved dynamic prompt block calls are left unchanged and reported as warnings.
8. Source maps remain usable for debugging transformed modules.
9. On a second machine with the repository cloned (including `codespec_gen`), unchanged inputs reuse committed artifacts without requiring fresh generation calls.
10. Generated artifacts and inlined payloads are TypeScript output.
11. Generation requests use the lowest provider-supported temperature (or deterministic equivalent), and repeated builds with unchanged inputs do not drift due to sampling variance.

## Relationship to Standard Library

The standard library defines common prompt block functions and usage patterns.

See [CodeSpec Standard Library Spec](./stdlib.spec.md).

Custom local CodeSpec file authoring/import patterns are defined in [CodeSpec Format Spec](./codespec.spec.md).

## Future Considerations

- Incremental persistent cache metadata optimized for large monorepos.
- Optional lockfile for deterministic team-wide generation snapshots.
- Parallel generation scheduling with provider rate-limit awareness.
- Pluggable post-processors (formatters, linters, safety validators) before inline rewrite.
