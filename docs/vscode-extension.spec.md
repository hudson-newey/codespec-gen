# CodeSpec VS Code Extension Specification

The CodeSpec VS Code extension provides IDE workflows for previewing and inlining generated code for CodeSpec compiler functions.

This specification defines the expected extension behavior for discovery, generation, and inlining of CodeSpec prompt blocks inside the editor.

## Purpose

The extension exists to make CodeSpec authoring and adoption faster by allowing developers to:

- expand CodeSpec compiler calls directly in the editor,
- preview generated output without manually running a separate build step,
- copy generated code,
- regenerate output,
- inline generated code in place of the original compiler call,
- navigate to generated concrete TypeScript implementations via Go to Definition,
- inspect generated TypeScript function signatures on hover for stronger typing workflows,
- inspect the effective context visible at each CodeSpec call site on hover.

## Scope

In scope:

- editor integration for CodeSpec prompt blocks,
- definition and validation of prompt block syntax as interpreted by the extension,
- generated code preview and actions,
- code replacement (inline) workflow,
- documentation generation workflow powered by LLMs.

Out of scope:

- runtime/build compiler semantics (see [Vite Plugin Spec](./plugin.spec.md)),
- definition of built-in prompt block APIs (see [CodeSpec Standard Library Spec](./stdlib.spec.md)).

## Supported Prompt Blocks

The extension must support all CodeSpec compiler/prompt block functions used by the package.

Examples include:

- `code$`
- `guard$`
- `context$`
- `docs$`

Behavior should not be hard-coded to only these names when additional CodeSpec compiler functions are introduced.

## User Experience

### 1. Discoverability

For supported CodeSpec compiler calls, the editor must provide an expand affordance (arrow) next to the call site.

### 2. Expansion

When expanded, the extension must render generated code associated with that prompt block.

### 3. Actions

The generated code view must provide these actions:

- `Copy`: copy generated code to clipboard.
- `Regenerate`: request a fresh generation for the same prompt block.
- `Inline`: replace the CodeSpec compiler call with generated code.

### 4. Inlining

When `Inline` is selected:

- the original CodeSpec compiler call expression is replaced by generated code,
- the resulting edit is applied directly to the open document,
- replacement should preserve surrounding file formatting as much as possible.

### 5. Hover Signature Preview

When hovering over a `code$` block, the extension must show the function signature inferred from or emitted by the generated TypeScript output.

The hover content should prioritize signature-level information (name, parameters, and return type) so developers can maintain strong TypeScript typing before inlining generated code.

### 6. Hover Context Preview

When hovering over a supported CodeSpec call site (`code$`, `guard$`, `context$`, `docs$`, and future prompt block functions), the extension must show the effective context used for that call site.

The hover content should make context provenance understandable (for example: local prompt block, inherited nearby `context$`, and any file-level/default context) so users can verify what inputs are influencing generation.

### 7. Go to Definition Routing

For supported CodeSpec compiler call sites, Go to Definition must resolve to the concrete generated TypeScript implementation artifact (for example in `codespec_gen`) rather than the source `.codespec.md` prompt definition.

If no generated implementation exists yet, the extension should surface a clear message explaining that generation must run first.

## Documentation Workflow

The extension should support documentation generation scenarios (for example through `docs$`) and present generated output through the same preview + action flow defined above.

## Functional Requirements

1. The extension must activate in JavaScript and TypeScript editor contexts where CodeSpec compiler calls appear.
2. The extension must identify supported CodeSpec prompt blocks in open files.
3. The extension must allow expanding recognized call sites to view generated output.
4. The extension must allow regeneration of output for an expanded block.
5. The extension must allow copying generated output.
6. The extension must allow inlining generated output at the call site.
7. The extension should keep generation scoped to the selected prompt block and relevant local context.
8. The extension must provide hover information for `code$` blocks that includes the generated TypeScript function signature.
9. The hover signature should update when generated output is regenerated.
10. The extension must provide hover information for each supported CodeSpec call site that includes the effective context used for that call site.
11. Go to Definition on supported CodeSpec compiler call sites must navigate to the generated concrete TypeScript implementation artifact, not the `.codespec.md` prompt source.

## Non-Functional Requirements

1. Expansion and action rendering should feel responsive for typical single-function prompt blocks.
2. Inline edits should be deterministic for a given generated payload and target location.
3. Failures (generation, parsing, or apply-edit) must surface a clear actionable message to the user.
4. Hover signature resolution should be fast enough to feel native to normal editor hover interactions.

## Acceptance Criteria

1. Given a file containing `code$`, `guard$`, `context$`, or `docs$`, an expand arrow is visible next to each supported call.
2. Expanding any supported call displays generated code plus `Copy`, `Regenerate`, and `Inline` actions.
3. Selecting `Copy` places exactly the displayed generated code on the clipboard.
4. Selecting `Regenerate` updates the preview with a newly generated result.
5. Selecting `Inline` replaces the original compiler call with generated code in the active editor.
6. If generation fails, the user sees an error message and can retry.
7. Hovering a `code$` block displays the generated TypeScript function signature.
8. After selecting `Regenerate`, a subsequent hover reflects the updated generated signature.
9. Hovering any supported CodeSpec call site displays the effective context for that call site.
10. Triggering Go to Definition from a supported CodeSpec compiler call site opens the generated concrete TypeScript implementation, not the `.codespec.md` prompt definition.

## Future Considerations

- Multi-block generation for related prompt calls in the same scope.
- Diff view between current preview and regenerated output.
- Configurable generation model/provider settings.
- Explicit preview of context inherited from nearby `context$` blocks.
