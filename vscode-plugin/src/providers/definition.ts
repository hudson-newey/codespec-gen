import * as vscode from "vscode";
import type { DocumentScanner } from "../scanner.js";
import type { ArtifactReader } from "../artifact-reader.js";

/**
 * Routes Go to Definition on CodeSpec call sites to the generated .ts
 * artifact file rather than the .codespec.md prompt definition.
 */
export class CodeSpecDefinitionProvider implements vscode.DefinitionProvider {
  constructor(
    private scanner: DocumentScanner,
    private artifacts: ArtifactReader,
  ) {}

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Definition | undefined {
    const site = this.scanner.getCallSiteAtPosition(document, position);
    if (!site || site.type === "context$") return undefined;

    const tsPath = this.artifacts.findArtifact(
      document.uri.fsPath,
      site.callStart,
    );

    if (!tsPath) {
      vscode.window.showInformationMessage(
        `No generated artifact found for this ${site.type} call — run your build first.`,
      );
      return undefined;
    }

    const targetUri = vscode.Uri.file(tsPath);
    return new vscode.Location(targetUri, new vscode.Position(0, 0));
  }
}
