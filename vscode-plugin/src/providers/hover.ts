import * as vscode from "vscode";
import * as path from "node:path";
import { loadDirectoryContext } from "@codespec/shared";
import type { DocumentScanner } from "../scanner.js";
import type { ArtifactReader } from "../artifact-reader.js";

const CODE_BLOCK_TYPES: Set<string> = new Set(["code$", "codespec-md"]);

/**
 * Provides hover information for CodeSpec call sites:
 * - `code$`: shows the TypeScript signature of the enclosing function.
 * - All call sites: shows effective context provenance (AGENTS.md, file-level,
 *   lexical context$).
 */
export class CodeSpecHoverProvider implements vscode.HoverProvider {
  constructor(
    private scanner: DocumentScanner,
    private artifacts: ArtifactReader,
    private workspaceRoot: string,
  ) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Hover | undefined> {
    const site = this.scanner.getCallSiteAtPosition(document, position);
    if (!site || site.type === "context$") return undefined;

    const sections: vscode.MarkdownString[] = [];

    // --- Signature section (code$ only) ---
    if (CODE_BLOCK_TYPES.has(site.type)) {
      const sig = this.extractEnclosingSignature(document, position);
      if (sig) {
        const md = new vscode.MarkdownString();
        md.appendMarkdown("**CodeSpec — generated signature**\n\n");
        md.appendCodeblock(sig, "typescript");
        sections.push(md);
      }
    }

    // --- Context provenance section ---
    const contextMd = await this.buildContextHover(
      document.uri.fsPath,
      site.context,
    );
    sections.push(contextMd);

    const combined = new vscode.MarkdownString(
      sections.map((s) => s.value).join("\n\n---\n\n"),
    );
    combined.isTrusted = true;
    combined.supportHtml = false;
    return new vscode.Hover(combined);
  }

  private extractEnclosingSignature(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): string | undefined {
    // Walk backwards from the hover line to find a function/method declaration.
    // We look for lines that match a function signature pattern.
    const text = document.getText();
    const offset = document.offsetAt(position);

    // Find the nearest enclosing function by scanning backwards for
    // "function", "=>" declarations, or method signatures.
    const before = text.slice(0, offset);
    const funcMatch = before.match(
      /(?:(?:export\s+)?(?:async\s+)?function\s+\w+[^{]*|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=>{]+)?\s*=>)[^{]*(?=\s*\{)/s,
    );
    if (!funcMatch) return undefined;

    // Return just the last matched signature (nearest enclosing)
    const allMatches = [
      ...before.matchAll(
        /(?:export\s+)?(?:async\s+)?function\s+\w+[^{]*|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=>{]+)?\s*=>/gs,
      ),
    ];
    if (allMatches.length === 0) return undefined;
    const last = allMatches[allMatches.length - 1];
    return last?.[0]?.trim().replace(/\s+/g, " ");
  }

  private async buildContextHover(
    filePath: string,
    lexicalContext: string[],
  ): Promise<vscode.MarkdownString> {
    const md = new vscode.MarkdownString();
    md.appendMarkdown("**CodeSpec — effective context**\n\n");

    // AGENTS.md chain
    let agentsEntries: string[] = [];
    try {
      agentsEntries = await loadDirectoryContext(filePath, this.workspaceRoot);
    } catch {
      // best-effort
    }

    if (agentsEntries.length > 0) {
      md.appendMarkdown("*From AGENTS.md chain:*\n\n");
      for (const entry of agentsEntries) {
        const preview = entry.slice(0, 120).replace(/\n/g, " ");
        md.appendMarkdown(`- ${preview}${entry.length > 120 ? "…" : ""}\n`);
      }
      md.appendMarkdown("\n");
    }

    if (lexicalContext.length > 0) {
      // Split into file-level (no enclosing function) vs lexical — we don't
      // have that distinction post-parse, so surface them together.
      md.appendMarkdown("*From `context$` calls:*\n\n");
      for (const ctx of lexicalContext) {
        md.appendMarkdown(`- \`${ctx}\`\n`);
      }
      md.appendMarkdown("\n");
    }

    if (agentsEntries.length === 0 && lexicalContext.length === 0) {
      md.appendMarkdown(
        "*No context found. Add `context$()` calls or an AGENTS.md file.*\n",
      );
    }

    return md;
  }
}
