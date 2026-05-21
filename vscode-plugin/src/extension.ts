import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand("codespec.hello", () => {
    vscode.window.showInformationMessage("CodeSpec extension scaffold is active.");
  });

  context.subscriptions.push(disposable);
}

export function deactivate(): void {
  // No-op for scaffold.
}
