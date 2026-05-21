import * as vscode from "vscode";
import type { DocumentScanner } from "../scanner.js";
import type { ArtifactReader } from "../artifact-reader.js";

/**
 * Provides expand affordance CodeLens items next to each CodeSpec call site.
 * Clicking the lens runs `codespec.expand` with the call site details.
 */
export class CodeSpecCodeLensProvider implements vscode.CodeLensProvider {
  private changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.changeEmitter.event;

  constructor(
    private scanner: DocumentScanner,
    private artifacts: ArtifactReader,
  ) {}

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const callSites = this.scanner.getCallSites(document);
    return callSites
      .filter((site) => site.type !== "context$")
      .map((site) => {
        const startPos = document.positionAt(site.callStart);
        const range = new vscode.Range(startPos, startPos);

        const hasArtifact = Boolean(
          this.artifacts.findArtifact(document.uri.fsPath, site.callStart),
        );

        const title = hasArtifact
          ? `$(arrow-right) Expand ${site.type}`
          : `$(warning) ${site.type} — run build to generate`;

        return new vscode.CodeLens(range, {
          title,
          command: hasArtifact ? "codespec.expand" : "codespec.regenerate",
          arguments: [
            {
              uri: document.uri.toString(),
              callStart: site.callStart,
              callEnd: site.callEnd,
              statementStart: site.statementStart,
              statementEnd: site.statementEnd,
              type: site.type,
            },
          ],
        });
      });
  }

  refresh(): void {
    this.changeEmitter.fire();
  }

  dispose(): void {
    this.changeEmitter.dispose();
  }
}
