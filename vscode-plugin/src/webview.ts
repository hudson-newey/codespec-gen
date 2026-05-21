import * as vscode from "vscode";

export interface CallSiteRef {
  uri: string;
  callStart: number;
  callEnd: number;
  statementStart: number;
  statementEnd: number;
  type: string;
}

type WebviewMessage =
  | { command: "copy" }
  | { command: "inline" }
  | { command: "regenerate" };

/**
 * Manages the singleton WebviewPanel that shows generated artifact code
 * with Copy, Inline, and Regenerate actions.
 */
export class ExpansionPanel {
  private static instance: ExpansionPanel | undefined;

  private panel: vscode.WebviewPanel;
  private currentSite: CallSiteRef | undefined;
  private currentCode: string | undefined;

  private constructor(extensionUri: vscode.Uri) {
    this.panel = vscode.window.createWebviewPanel(
      "codespec.expansion",
      "CodeSpec — Generated",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      },
    );

    this.panel.webview.onDidReceiveMessage((msg: WebviewMessage) => {
      switch (msg.command) {
        case "copy":
          this.handleCopy();
          break;
        case "inline":
          this.handleInline();
          break;
        case "regenerate":
          this.handleRegenerate();
          break;
      }
    });

    this.panel.onDidDispose(() => {
      ExpansionPanel.instance = undefined;
    });
  }

  static show(
    extensionUri: vscode.Uri,
    site: CallSiteRef,
    artifactCode: string,
  ): void {
    if (!ExpansionPanel.instance) {
      ExpansionPanel.instance = new ExpansionPanel(extensionUri);
    }
    ExpansionPanel.instance.update(site, artifactCode);
  }

  private update(site: CallSiteRef, code: string): void {
    this.currentSite = site;
    this.currentCode = code;
    this.panel.title = `CodeSpec — ${site.type}`;
    this.panel.reveal(vscode.ViewColumn.Beside, true);
    this.panel.webview.html = this.buildHtml(site.type, code);
  }

  private handleCopy(): void {
    if (!this.currentCode) return;
    vscode.env.clipboard.writeText(this.currentCode).then(() => {
      vscode.window.showInformationMessage(
        "CodeSpec: Generated code copied to clipboard.",
      );
    });
  }

  private handleInline(): void {
    if (!this.currentSite || !this.currentCode) return;
    const site = this.currentSite;
    const code = this.currentCode;

    const uri = vscode.Uri.parse(site.uri);
    const document = vscode.workspace.textDocuments.find(
      (d) => d.uri.toString() === uri.toString(),
    );
    if (!document) {
      vscode.window.showErrorMessage("CodeSpec: Source document is not open.");
      return;
    }

    const edit = new vscode.WorkspaceEdit();
    const isJsDocBlock = code.trimStart().startsWith("/**");

    if (isJsDocBlock) {
      // Replace the whole statement (including trailing semicolon/newline)
      const start = document.positionAt(site.statementStart);
      const end = document.positionAt(site.statementEnd);
      // Preserve leading indentation from the statement's line
      const indentLine = document.lineAt(start.line);
      const indent = indentLine.text.match(/^(\s*)/)?.[1] ?? "";
      const indented = code
        .split("\n")
        .map((l, i) => (i === 0 ? l : indent + l))
        .join("\n");
      edit.replace(uri, new vscode.Range(start, end), indented);
    } else {
      // Replace just the call expression
      const start = document.positionAt(site.callStart);
      const end = document.positionAt(site.callEnd);
      edit.replace(uri, new vscode.Range(start, end), code);
    }

    vscode.workspace.applyEdit(edit).then((success) => {
      if (success) {
        vscode.window.showInformationMessage(
          "CodeSpec: Generated code inlined.",
        );
        this.panel.dispose();
      } else {
        vscode.window.showErrorMessage(
          "CodeSpec: Failed to apply inline edit.",
        );
      }
    });
  }

  private handleRegenerate(): void {
    vscode.window.showInformationMessage(
      "CodeSpec: Run your project build to regenerate this artifact, then expand again.",
    );
  }

  private buildHtml(blockType: string, code: string): string {
    const escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeSpec — ${blockType}</title>
  <style>
    body {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--vscode-editor-font-size, 13px);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      margin: 0;
      padding: 12px 16px;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .badge {
      font-size: 11px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 4px;
      padding: 2px 8px;
    }
    .actions {
      display: flex;
      gap: 8px;
    }
    button {
      font-size: 12px;
      padding: 4px 12px;
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 3px;
      cursor: pointer;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    button.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    button.primary:hover {
      background: var(--vscode-button-hoverBackground);
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-all;
      background: var(--vscode-textCodeBlock-background);
      border: 1px solid var(--vscode-editorWidget-border, transparent);
      border-radius: 4px;
      padding: 12px;
      overflow: auto;
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="badge">${blockType}</span>
    <div class="actions">
      <button onclick="send('copy')">Copy</button>
      <button class="primary" onclick="send('inline')">Inline</button>
      <button onclick="send('regenerate')">Regenerate</button>
    </div>
  </div>
  <pre><code>${escaped}</code></pre>
  <script>
    const vscode = acquireVsCodeApi();
    function send(command) { vscode.postMessage({ command }); }
  </script>
</body>
</html>`;
  }
}
