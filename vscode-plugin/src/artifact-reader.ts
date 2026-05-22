import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";

const LOOKUP_FILENAME = "lookup.json";
const CODESPEC_GEN_DIRNAME = "codespec_gen";

/** A single loaded lookup store, scoped to one Vite project root. */
interface LookupStore {
  /** The Vite project root — parent directory of codespec_gen/. */
  base: string;
  entries: Record<string, string>;
}

/**
 * Reads all codespec_gen/lookup.json files found anywhere in the workspace
 * and resolves source call-site positions to their generated .ts artifact
 * file paths.
 *
 * Supports workspaces where the Vite project root is a sub-folder of the
 * workspace root: the project root is inferred as the grandparent directory
 * of each discovered lookup.json.
 */
export class ArtifactReader implements vscode.Disposable {
  private stores: LookupStore[] = [];
  private watcher: vscode.FileSystemWatcher | undefined;
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange: vscode.Event<void> = this._onDidChange.event;

  // workspaceRoot kept for backward-compatible constructor signature.
  constructor(_workspaceRoot: string) {
    this.refresh();
    this.watchLookups();
  }

  /**
   * Returns the absolute path to the .ts artifact for the given call site,
   * or undefined if no artifact has been generated yet.
   *
   * Searches across all discovered project roots so multi-project workspaces
   * and sub-folder Vite projects resolve correctly.
   */
  findArtifact(sourceFilePath: string, callStart: number): string | undefined {
    for (const { base, entries } of this.stores) {
      const relSource = path.relative(base, sourceFilePath);
      const key = `${relSource}:${callStart}`;
      const relTs = entries[key];
      if (!relTs) continue;
      const abs = path.join(base, relTs);
      if (fs.existsSync(abs)) return abs;
    }
    return undefined;
  }

  /** Reads and returns the content of a .ts artifact file. */
  readArtifact(tsFilePath: string): string {
    return fs.readFileSync(tsFilePath, "utf-8");
  }

  dispose(): void {
    this.watcher?.dispose();
    this._onDidChange.dispose();
  }

  /**
   * (Re)discover all lookup.json files in the workspace and reload their
   * contents. Fires onDidChange when complete so consumers can refresh.
   */
  private refresh(): void {
    vscode.workspace
      .findFiles(
        `**/${CODESPEC_GEN_DIRNAME}/${LOOKUP_FILENAME}`,
        "**/node_modules/**",
      )
      .then((uris) => {
        this.stores = uris
          .map((uri) => this.loadStore(uri.fsPath))
          .filter((s): s is LookupStore => s !== null);
        this._onDidChange.fire();
      });
  }

  private loadStore(lookupPath: string): LookupStore | null {
    try {
      const raw = fs.readFileSync(lookupPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) return null;
      // Project root is the parent of codespec_gen/, i.e. grandparent of lookup.json.
      const base = path.dirname(path.dirname(lookupPath));
      return { base, entries: parsed as Record<string, string> };
    } catch {
      return null;
    }
  }

  private watchLookups(): void {
    // Watch any codespec_gen/lookup.json anywhere in the workspace.
    this.watcher = vscode.workspace.createFileSystemWatcher(
      `**/${CODESPEC_GEN_DIRNAME}/${LOOKUP_FILENAME}`,
    );
    this.watcher.onDidChange(() => this.refresh());
    this.watcher.onDidCreate(() => this.refresh());
  }
}
