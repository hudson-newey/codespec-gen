import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";

const LOOKUP_FILENAME = "lookup.json";
const CODESPEC_GEN_DIR = "codespec_gen";

/**
 * Reads the lookup.json index written by the Vite plugin and resolves
 * source call-site positions to their generated .ts artifact file paths.
 */
export class ArtifactReader {
  private workspaceRoot: string;
  private lookup: Record<string, string> = {};
  private watcher: vscode.FileSystemWatcher | undefined;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.loadLookup();
    this.watchLookup();
  }

  /**
   * Returns the absolute path to the .ts artifact for the given call site,
   * or undefined if no artifact has been generated yet.
   */
  findArtifact(sourceFilePath: string, callStart: number): string | undefined {
    const relSource = path.relative(this.workspaceRoot, sourceFilePath);
    const key = `${relSource}:${callStart}`;
    const relTs = this.lookup[key];
    if (!relTs) return undefined;
    const abs = path.join(this.workspaceRoot, relTs);
    return fs.existsSync(abs) ? abs : undefined;
  }

  /** Reads and returns the content of a .ts artifact file. */
  readArtifact(tsFilePath: string): string {
    return fs.readFileSync(tsFilePath, "utf-8");
  }

  dispose(): void {
    this.watcher?.dispose();
  }

  private get lookupPath(): string {
    return path.join(this.workspaceRoot, CODESPEC_GEN_DIR, LOOKUP_FILENAME);
  }

  private loadLookup(): void {
    try {
      if (fs.existsSync(this.lookupPath)) {
        const raw = fs.readFileSync(this.lookupPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null) {
          this.lookup = parsed as Record<string, string>;
        }
      }
    } catch {
      this.lookup = {};
    }
  }

  private watchLookup(): void {
    const pattern = new vscode.RelativePattern(
      this.workspaceRoot,
      `${CODESPEC_GEN_DIR}/${LOOKUP_FILENAME}`,
    );
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
    this.watcher.onDidChange(() => this.loadLookup());
    this.watcher.onDidCreate(() => this.loadLookup());
  }
}
