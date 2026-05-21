# AGENTS

This repository is specification-first and now includes initial
implementation scaffolding. Prioritize spec quality and cross-document
alignment, and ensure implementation work remains consistent with specs.

## Scope and Current State

- Primary design still lives in Markdown specs under `docs/`.
- Initial Nx + pnpm monorepo scaffolding is present at the repository root.
- Implementation artifacts currently live in:
  - `plugin/` for the Vite plugin package
  - `dev/` for the Vite dev website app
  - `vscode-plugin/` for the VS Code extension package
- Legacy `vscode-extension/` docs and skills remain canonical reference
  material for extension behavior and UX requirements.

## Read First (In Order)

1. [README.md](README.md)
2. [CodeSpec Format Spec](docs/codespec.spec.md)
3. [Vite Plugin Spec](docs/plugin.spec.md)
4. [CodeSpec Standard Library Spec](docs/stdlib.spec.md)
5. [VS Code Extension Spec](docs/vscode-extension.spec.md)
6. [Context Spec](docs/context.spec.md)
7. [Create CodeSpec Skill](vscode-extension/skills/create-codespec/SKILL.md)
8. Root workspace config: `package.json`, `pnpm-workspace.yaml`, `nx.json`
9. Project configs: `plugin/project.json`, `dev/project.json`,
   `vscode-plugin/project.json`

## Agent Working Rules

- Prefer editing existing spec files over creating new top-level docs.
- Keep terminology consistent across specs (`code$`, `guard$`, `context$`,
  `docs$`, `.codespec.md`).
- When updating one spec, check for required alignment updates in related specs.
- Link to canonical docs instead of duplicating detailed explanations.
- For implementation edits, keep project boundaries clear (`plugin`, `dev`,
  `vscode-plugin`) and preserve workspace-level Nx target wiring.

## Conventions to Preserve

- CodeSpec files use `.codespec.md` naming and kebab-case names.
- Skill/frontmatter fields should remain valid YAML and use quoted strings when
  values contain punctuation.
- Keep examples practical and TypeScript-oriented unless a spec explicitly says
  otherwise.

## Known Pitfalls

- Do not invent runnable commands or claim tests/builds passed unless you
  actually verified them.
- `context$` scope is local and should not be documented as globally persistent.
- Plugin transform behavior depends on AST-discovered, non-shadowed function
  calls; avoid language that implies runtime reflection.

## Editor and Formatting Notes

- Workspace settings in `codespec.code-workspace` indicate:
  - 2-space indentation
  - format on save (Prettier)
  - explicit ESLint fix-all actions
  - rulers at 80 and 120 columns

## Implementation Notes

- The initial scaffolding has already been created.
- Use `pnpm install` at root for dependencies.
- Use root scripts (`pnpm build`, `pnpm dev`, `pnpm nx ...`) for orchestrated
  commands.
- Keep generated or demo behavior minimal and spec-aligned until concrete
  implementation requirements are added.
