import * as vscode from "vscode";
import * as path from "node:path";

const CODESPEC_TEMPLATE = (
  name: string,
  description: string,
  argumentHint: string,
  body: string,
): string => `---
name: ${name}
description: "${description}"
argument-hint: '${argumentHint}'
user-invocable: true
---

${body}
`;

const BODY_TEMPLATE = (
  title: string,
  description: string,
  params: string,
  rules: string,
  outputDescription: string,
): string => `# ${title}

${description}

## Parameters

${params}

## Generation Rules

${rules}

## Expected Output

${outputDescription}
When invoked, only output the requested implementation code enclosed in a markdown block.

## Example

### Inputs

\`\`\`json
{}
\`\`\`

### Generated Code

\`\`\`typescript
// Example generated code here
\`\`\`
`;

interface GatheredInputs {
  name: string;
  description: string;
  argumentHint: string;
  title: string;
  bodyDescription: string;
  params: string;
  rules: string;
  outputDescription: string;
}

function parseInputs(text: string): Partial<GatheredInputs> {
  const inputs: Partial<GatheredInputs> = {};

  // Try to extract name from text
  const nameMatch = text.match(
    /(?:name|call it|named?)[:\s]+([a-z][a-z0-9-]*)/i,
  );
  if (nameMatch) inputs.name = nameMatch[1]!.toLowerCase().replace(/\s+/g, "-");

  // Try to extract description
  const descMatch = text.match(
    /(?:description|does|generates?|creates?)[:\s]+(.+?)(?:\.|$)/i,
  );
  if (descMatch) inputs.description = descMatch[1]!.trim();

  return inputs;
}

async function streamReply(
  stream: vscode.ChatResponseStream,
  text: string,
): Promise<void> {
  stream.markdown(text);
}

/**
 * Handles the `@codespec /create` chat participant command.
 * Guides the user through authoring inputs and creates a `.codespec.md` file.
 */
export async function handleCreateCodeSpec(
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<void> {
  if (token.isCancellationRequested) return;

  const userText = request.prompt.trim();
  const gathered: Partial<GatheredInputs> = parseInputs(userText);

  // Pull gathered info from conversation history if present
  for (const turn of context.history) {
    if (turn instanceof vscode.ChatResponseTurn) continue;
    const prev = parseInputs((turn as vscode.ChatRequestTurn).prompt);
    Object.assign(gathered, prev);
  }

  // Check what we still need
  const missing: string[] = [];
  if (!gathered.name) missing.push("**name** (kebab-case, e.g. `deep-clone`)");
  if (!gathered.description)
    missing.push("**description** (what does this CodeSpec generate?)");

  if (missing.length > 0) {
    await streamReply(
      stream,
      `To create a \`.codespec.md\` file, I need a few more details:\n\n` +
        missing.map((m) => `- ${m}`).join("\n") +
        `\n\nPlease provide these and I'll create the file for you.`,
    );
    return;
  }

  const name = gathered.name!;
  const description = gathered.description!;
  const argumentHint = gathered.argumentHint ?? "";
  const title = name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const params = gathered.params ?? "- `input`: The primary input value";
  const rules =
    gathered.rules ??
    "- **Language**: TypeScript/JavaScript\n- **Behavior**: implement as described";
  const outputDescription =
    gathered.outputDescription ??
    "A single TypeScript expression or statement block.";

  const content = CODESPEC_TEMPLATE(
    name,
    description,
    argumentHint,
    BODY_TEMPLATE(title, description, params, rules, outputDescription),
  );

  // Validate frontmatter basics
  if (!name.match(/^[a-z][a-z0-9-]*$/)) {
    await streamReply(
      stream,
      `**Error**: The name \`${name}\` is not valid. CodeSpec names must be kebab-case (e.g. \`my-spec\`). Please try again with a valid name.`,
    );
    return;
  }

  // Ask user where to save the file
  const defaultUri = (() => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return undefined;
    return vscode.Uri.file(
      path.join(folders[0]!.uri.fsPath, `${name}.codespec.md`),
    );
  })();

  const saveUri = await vscode.window.showSaveDialog({
    defaultUri,
    filters: { "CodeSpec files": ["codespec.md"] },
    title: `Save ${name}.codespec.md`,
  });

  if (!saveUri) {
    await streamReply(stream, "File creation cancelled.");
    return;
  }

  if (!saveUri.fsPath.endsWith(".codespec.md")) {
    await streamReply(
      stream,
      `**Error**: The file must have a \`.codespec.md\` extension. Please try again.`,
    );
    return;
  }

  try {
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(saveUri, encoder.encode(content));
    await vscode.window.showTextDocument(saveUri);
    await streamReply(
      stream,
      `Created \`${path.basename(saveUri.fsPath)}\` at \`${saveUri.fsPath}\`.\n\n` +
        `Import and use it like:\n\n` +
        "```typescript\nimport " +
        toCamelCase(name) +
        `$ from "./${name}.codespec.md";\n\n` +
        `const result = ` +
        toCamelCase(name) +
        `$(\`your instruction here\`);\n\`\`\``,
    );
  } catch (err) {
    await streamReply(
      stream,
      `**Error**: Failed to create the file — ${String(err)}. Please try again.`,
    );
  }
}

function toCamelCase(kebab: string): string {
  return kebab
    .split("-")
    .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join("");
}
