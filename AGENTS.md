# AGENTS

This repository is currently specification-first. Prioritize spec quality,
consistency, and cross-document alignment over implementation tasks.

## Scope and Current State

- Primary work happens in Markdown specs under `docs/`.
- `plugin/` and `dev/` are placeholders for future implementation.
- There is no verified `package.json`, build script, or test runner yet.

## Read First (In Order)

1. [README.md](README.md)
2. [CodeSpec Format Spec](docs/codespec.spec.md)
3. [Vite Plugin Spec](docs/plugin.spec.md)
4. [CodeSpec Standard Library Spec](docs/stdlib.spec.md)
5. [VS Code Extension Spec](docs/vscode-extension.spec.md)
6. [Context Spec](docs/context.spec.md)
7. [Create CodeSpec Skill](vscode-extension/skills/create-codespec/SKILL.md)

## Agent Working Rules

- Prefer editing existing spec files over creating new top-level docs.
- Keep terminology consistent across specs (`code$`, `guard$`, `context$`,
  `docs$`, `.codespec.md`).
- When updating one spec, check for required alignment updates in related specs.
- Link to canonical docs instead of duplicating detailed explanations.

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

## If Asked to Implement Code

- First confirm whether implementation scaffolding should be created.
- If scaffolding is requested, align initial structure to the specs above.
