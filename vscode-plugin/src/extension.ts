import * as vscode from "vscode";
import { DocumentScanner } from "./scanner.js";
import { ArtifactReader } from "./artifact-reader.js";
import { CodeSpecCodeLensProvider } from "./providers/codelens.js";
import { CodeSpecHoverProvider } from "./providers/hover.js";
import { CodeSpecDefinitionProvider } from "./providers/definition.js";
import { ExpansionPanel, type CallSiteRef } from "./webview.js";
import { handleCreateCodeSpec } from "./chat-participant.js";

const SUPPORTED_LANGUAGES = [
  { scheme: "file", language: "typescript" },
  { scheme: "file", language: "javascript" },
  { scheme: "file", language: "typescriptreact" },
  { scheme: "file", language: "javascriptreact" },
];

export function activate(context: vscode.ExtensionContext): void {
  const workspaceRoot =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();

  const scanner = new DocumentScanner();
  const artifacts = new ArtifactReader(workspaceRoot);
  const codeLens = new CodeSpecCodeLensProvider(scanner, artifacts);

  // --- Providers ---
  for (const selector of SUPPORTED_LANGUAGES) {
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(selector, codeLens),
      vscode.languages.registerHoverProvider(
        selector,
        new CodeSpecHoverProvider(scanner, artifacts, workspaceRoot),
      ),
      vscode.languages.registerDefinitionProvider(
        selector,
        new CodeSpecDefinitionProvider(scanner, artifacts),
      ),
    );
  }

  // Refresh CodeLens whenever the artifact reader discovers new or changed
  // lookup.json files (i.e. after a build writes fresh generated artifacts).
  context.subscriptions.push(
    artifacts.onDidChange(() => codeLens.refresh()),
    artifacts,
  );

  // Invalidate scanner cache on document close
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) =>
      scanner.invalidate(doc.uri),
    ),
  );

  // --- Commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand("codespec.expand", (site: CallSiteRef) => {
      const doc = vscode.workspace.textDocuments.find(
        (d) => d.uri.toString() === site.uri,
      );
      if (!doc) {
        vscode.window.showErrorMessage(
          "CodeSpec: Source document is not open.",
        );
        return;
      }
      const tsPath = artifacts.findArtifact(doc.uri.fsPath, site.callStart);
      if (!tsPath) {
        vscode.window.showInformationMessage(
          `CodeSpec: No generated artifact found for ${site.type} — run your build first.`,
        );
        return;
      }
      const code = artifacts.readArtifact(tsPath);
      ExpansionPanel.show(context.extensionUri, site, code);
    }),

    vscode.commands.registerCommand(
      "codespec.regenerate",
      (_site?: CallSiteRef) => {
        vscode.window.showInformationMessage(
          "CodeSpec: Run your project build to generate or refresh artifacts, then expand again.",
        );
      },
    ),

    vscode.commands.registerCommand("codespec.copy", () => {
      vscode.window.showInformationMessage(
        "CodeSpec: Use the Copy button in the expanded view.",
      );
    }),

    vscode.commands.registerCommand("codespec.inline", () => {
      vscode.window.showInformationMessage(
        "CodeSpec: Use the Inline button in the expanded view.",
      );
    }),
  );

  // --- Copilot chat participant ---
  const participant = vscode.chat.createChatParticipant(
    "codespec.create",
    async (request, chatContext, stream, token) => {
      await handleCreateCodeSpec(request, chatContext, stream, token);
    },
  );
  participant.iconPath = new vscode.ThemeIcon("code");
  context.subscriptions.push(participant);
}

export function deactivate(): void {
  // nothing
}
