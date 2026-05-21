import { SCHEMA_VERSION } from "./schema.js";

let wasmInitialized = false;
let xxhash: Awaited<ReturnType<typeof import("xxhash-wasm").default>> | null =
  null;

async function getHasher() {
  if (!wasmInitialized) {
    const { default: init } = await import("xxhash-wasm");
    xxhash = await init();
    wasmInitialized = true;
  }
  return xxhash!;
}

export interface CacheKeyInput {
  promptBlockType: string;
  /** Normalized (trimmed, collapsed whitespace) instruction text */
  instruction: string;
  /** Normalized serialized arguments */
  args: string[];
  /** Ordered effective context entries */
  effectiveContext: string[];
  /** Concatenated AGENTS.md content in root-to-nearest order */
  agentsMdContent: string;
  /** Model/provider identifier string */
  modelId: string;
  /** Serializable generation options (e.g. temperature, maxTokens) */
  generationOptions: Record<string, unknown>;
}

/**
 * Compute a deterministic hex cache key for a prompt block generation request.
 * The key includes a schema version so that future breaking changes bust caches.
 */
export async function computeCacheKey(input: CacheKeyInput): Promise<string> {
  const hasher = await getHasher();

  const payload = JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    promptBlockType: input.promptBlockType,
    instruction: normalizeText(input.instruction),
    args: input.args.map(normalizeText),
    effectiveContext: input.effectiveContext.map(normalizeText),
    agentsMdContent: normalizeText(input.agentsMdContent),
    modelId: input.modelId,
    generationOptions: input.generationOptions,
  });

  const hash = hasher.h64ToString(payload);
  return hash;
}

/** Trim and collapse runs of whitespace for stable keys */
function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}
