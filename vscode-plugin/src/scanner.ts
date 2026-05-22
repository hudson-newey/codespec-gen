import * as vscode from "vscode";
import QuickLRU from "quick-lru";
import { parseSource, resolveImports, findCallSites } from "../../shared/src/index.js";
import type { CallSite } from "../../shared/src/index.js";

interface ScanResult {
  callSites: CallSite[];
  version: number;
}

/**
 * Parses open documents and caches the located CodeSpec call sites per
 * document version. Uses quick-lru to bound memory usage.
 */
export class DocumentScanner {
  private cache = new QuickLRU<string, ScanResult>({ maxSize: 50 });

  /** Returns all CodeSpec call sites found in the document, using a cached
   *  result when the document version hasn't changed. */
  getCallSites(document: vscode.TextDocument): CallSite[] {
    const key = document.uri.toString();
    const cached = this.cache.get(key);
    if (cached && cached.version === document.version) {
      return cached.callSites;
    }

    const callSites = this.scan(document);
    this.cache.set(key, { callSites, version: document.version });
    return callSites;
  }

  /** Returns the call site whose range contains the given position, or undefined. */
  getCallSiteAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): CallSite | undefined {
    const offset = document.offsetAt(position);
    return this.getCallSites(document).find(
      (site) => offset >= site.callStart && offset <= site.callEnd,
    );
  }

  /** Invalidate the cached result for a document (e.g. on close). */
  invalidate(uri: vscode.Uri): void {
    this.cache.delete(uri.toString());
  }

  private scan(document: vscode.TextDocument): CallSite[] {
    const code = document.getText();
    const filePath = document.uri.fsPath;

    let ast;
    try {
      ast = parseSource(code, filePath);
    } catch {
      return [];
    }

    const { bindings } = resolveImports(ast, filePath);
    if (bindings.size === 0) return [];

    try {
      return findCallSites(ast, bindings);
    } catch {
      return [];
    }
  }
}
