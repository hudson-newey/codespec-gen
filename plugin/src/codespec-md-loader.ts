import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import * as path from "node:path";

const CODESPEC_MD_MARKER = "__codespec_md__";

/** Strips YAML frontmatter from a markdown string and returns the body */
function stripFrontmatter(content: string): {
  body: string;
  frontmatter: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (match) {
    return { frontmatter: match[1]!, body: match[2]! };
  }
  return { frontmatter: "", body: content };
}

/**
 * Registry of .codespec.md file contents keyed by absolute path.
 * Populated by the `load` hook; consumed by the transform pipeline.
 */
export class CodespecMdRegistry {
  private registry = new Map<string, string>();

  get(absolutePath: string): string | undefined {
    return this.registry.get(absolutePath);
  }

  set(absolutePath: string, content: string): void {
    this.registry.set(absolutePath, content);
  }

  asMap(): Map<string, string> {
    return new Map(this.registry);
  }
}

/**
 * Returns a Vite plugin that handles `.codespec.md` imports.
 *
 * The `resolveId` hook intercepts them and tags the id.
 * The `load` hook reads the file, stores its content in the registry,
 * and returns a TypeScript stub module so Vite can continue bundling.
 */
export function createCodespecMdPlugin(registry: CodespecMdRegistry) {
  return {
    name: "codespec-md-loader",

    resolveId(id: string, importer: string | undefined): string | null {
      if (!id.endsWith(".codespec.md")) return null;

      // Resolve relative imports to absolute path
      if (importer && !path.isAbsolute(id)) {
        const resolved = path.resolve(path.dirname(importer), id);
        return resolved;
      }

      return path.isAbsolute(id) ? id : null;
    },

    async load(id: string): Promise<string | null> {
      if (!id.endsWith(".codespec.md")) return null;

      if (!existsSync(id)) {
        throw new Error(`CodeSpec: Cannot find .codespec.md file: ${id}`);
      }

      const raw = await readFile(id, "utf-8");
      const { body } = stripFrontmatter(raw);
      registry.set(id, body.trim());

      // Return a TypeScript stub module.
      // The transform step identifies calls to this export by recognizing
      // the CODESPEC_MD_MARKER comment and the binding type from import-resolver.
      return `// ${CODESPEC_MD_MARKER}::${id}
// This stub is replaced at compile time by the CodeSpec Vite plugin.
export default function codespecMdStub(
  args?: Record<string, unknown>,
): never {
  throw new Error(
    "CodeSpec: This function was not compiled. Ensure the CodeSpec Vite plugin is active.",
  );
}
`;
    },
  };
}
