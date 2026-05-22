import type { LanguageModelV3 } from "@ai-sdk/provider";
import type { CallSite } from "../../shared/src/index.js";

export interface CodeSpecPluginOptions {
  /**
   * A Vercel AI SDK compatible language model used for code generation.
   * Example: `openai("gpt-4o")`, `anthropic("claude-opus-4-5")`, `ollama("gemma4")`
   */
  provider: LanguageModelV3;

  /**
   * Directory where generated artifacts are persisted.
   * @default "<projectRoot>/codespec_gen"
   */
  cacheDir?: string;

  /**
   * When true, unresolvable call sites and generation failures cause the
   * build to fail. When false (default), they emit warnings and are skipped.
   * @default false
   */
  strict?: boolean;

  /**
   * Glob patterns for files that should be transformed.
   * Defaults to all JS/TS files.
   */
  include?: string[];

  /**
   * Glob patterns for files that should NOT be transformed.
   */
  exclude?: string[];

  /**
   * When true, no generation calls are made. Only committed artifacts in
   * `cacheDir` are used. Cache misses produce warnings (lenient) or errors (strict).
   * @default false
   */
  offline?: boolean;

  /**
   * Global default context entries prepended before all other context.
   * Equivalent to a top-level `context$()` call applied to every file.
   */
  defaultContext?: string[];
}

export interface ResolvedOptions {
  provider: LanguageModelV3;
  cacheDir: string;
  strict: boolean;
  include: string[];
  exclude: string[];
  offline: boolean;
  defaultContext: string[];
  projectRoot: string;
}

/** A call site enriched with resolved context and cache key */
export interface EnrichedCallSite extends CallSite {
  effectiveContext: string[];
  agentsMdContent: string;
  cacheKey: string;
}

/** Severity level for plugin diagnostics */
export type DiagnosticSeverity = "error" | "warn" | "info";

export interface Diagnostic {
  severity: DiagnosticSeverity;
  message: string;
  file?: string;
  offset?: number;
}
