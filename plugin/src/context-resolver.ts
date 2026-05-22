import type { CallSite } from "../../shared/src/index.js";
import { loadDirectoryContext } from "../../shared/src/index.js";
import type { ResolvedOptions } from "./types.js";

/**
 * Compute the full ordered context for a call site:
 *   1. Plugin defaultContext
 *   2. AGENTS.md directory context (root → nearest parent)
 *   3. Lexical context$ entries from the call site
 */
export async function resolveEffectiveContext(
  callSite: CallSite,
  filePath: string,
  opts: ResolvedOptions,
): Promise<{ effectiveContext: string[]; agentsMdContent: string }> {
  const agentsMdEntries = await loadDirectoryContext(
    filePath,
    opts.projectRoot,
  );

  const agentsMdContent = agentsMdEntries.join("\n\n");

  const effectiveContext = [
    ...opts.defaultContext,
    ...agentsMdEntries,
    ...callSite.context,
  ];

  return { effectiveContext, agentsMdContent };
}
