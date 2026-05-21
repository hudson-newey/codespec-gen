// AST utilities
export { parseSource } from "./ast/parser.js";
export { resolveImports } from "./ast/import-resolver.js";
export type {
  BuiltinPromptBlock,
  BindingType,
  BindingMap,
  CodespecMdPaths,
  ResolvedImports,
} from "./ast/import-resolver.js";
export { findCallSites } from "./ast/call-site-finder.js";
export type { CallSite } from "./ast/call-site-finder.js";
export { ScopeTracker, isScopeBoundary } from "./ast/scope-tracker.js";

// Cache utilities
export { computeCacheKey } from "./cache/key.js";
export type { CacheKeyInput } from "./cache/key.js";
export {
  ArtifactMetadataSchema,
  ArtifactEntrySchema,
  ArtifactManifestSchema,
  SCHEMA_VERSION,
} from "./cache/schema.js";
export type {
  ArtifactMetadata,
  ArtifactEntry,
  ArtifactManifest,
} from "./cache/schema.js";

// Context utilities
export { loadDirectoryContext } from "./context/agents-md.js";

