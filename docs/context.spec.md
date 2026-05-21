# CodeSpec Context Specification

This specification defines how CodeSpec context is scoped and resolved for
compile-time prompt block generation.

The canonical context primitive is `context$` from the standard library.
See [CodeSpec Standard Library Spec](./stdlib.spec.md).

## Purpose

Context scoping exists so generated output can be influenced by local
assumptions without introducing hidden global state.

This specification defines:

- where context is visible,
- how nested scopes inherit or override context,
- how multiple `context$` calls are combined,
- how directory-level `AGENTS.md` files contribute context,
- when context stops applying.

## Scope

In scope:

- lexical scoping behavior for `context$`,
- ordering and inheritance of context entries,
- directory-level `AGENTS.md` context inheritance,
- interaction with plugin/file-level context defaults,
- diagnostics behavior when context cannot be resolved statically.

Out of scope:

- authoring format for `.codespec.md` files (see
  [CodeSpec Format Spec](./codespec.spec.md)),
- full plugin transform lifecycle (see
  [CodeSpec Vite Plugin Spec](./plugin.spec.md)),
- non-context prompt block APIs (see
  [CodeSpec Standard Library Spec](./stdlib.spec.md)).

## Core Rules

1. `context$` is compile-time only. It does not create runtime state.
2. `context$` applies lexically, not dynamically.
3. A `context$` call affects prompt block calls that are lexically within the
   same scope (and child scopes) after that call site.
4. Exiting a scope removes that scope's local context entries.
5. Context does not persist across files unless explicitly imported and
   re-applied in that file.
6. Context entries are additive and ordered by source appearance within the
   same scope.

## Directory-Level `AGENTS.md` Context

Directory context is discovered from `AGENTS.md` files on the path from project
root to the directory containing the current source file.

Rules:

1. If `<projectRoot>/AGENTS.md` exists, it applies to all prompt block calls in
   the project.
2. For a file at `<projectRoot>/a/b/c/file.ts`, context may additionally include
   `<projectRoot>/a/AGENTS.md`, `<projectRoot>/a/b/AGENTS.md`, and
   `<projectRoot>/a/b/c/AGENTS.md` when present.
3. Only `AGENTS.md` files in parent directories of the current file (including
   the file's own directory) are included.
4. `AGENTS.md` files in child directories, sibling directories, or unrelated
   branches must not be included.
5. `AGENTS.md` files are merged in path order from root to nearest parent.

## Lexical Scoping Model

The effective context at a prompt block call is built from outer to inner
scopes.

Recommended precedence (lowest to highest):

1. Plugin/global default context.
2. Directory-level `AGENTS.md` context (root to nearest parent directory).
3. File-level statically analyzable context.
4. Outer lexical scope `context$` entries.
5. Nearest lexical scope `context$` entries.
6. Explicit call-site context arguments, if supported by that prompt block.

Within each level, entries are concatenated in source order.

## Scope Boundaries

Scope boundaries follow normal JavaScript/TypeScript lexical rules.

- Module scope: top-level file scope.
- Function scope: inside function bodies.
- Block scope: inside blocks such as `if`, `for`, and `while`.

Inner scopes inherit active outer context entries. Inner scopes may add more
entries using additional `context$` calls.

## Ordering Semantics

`context$` is order-sensitive within a scope.

- A `context$` call does not retroactively affect earlier prompt block calls.
- Multiple `context$` calls in the same scope are merged in appearance order.

## Examples

### Module and Function Scoping

```ts
context$("Use strict TypeScript and ESM.");

const a = code$("Create a slug helper."); // uses module context

function buildAdapter() {
  context$("Target fetch API in Node.js 20.");

  const b = code$("Create an HTTP adapter.");
  // uses both module context and function-local context
}

const c = code$("Create a logger utility.");
// uses module context only
```

### Block Scoping

```ts
function buildParser(debug: boolean) {
  context$("Prefer pure functions.");

  if (debug) {
    context$("Include verbose diagnostics.");
    const parser = code$("Create a parser.");
    // includes both context entries
  }

  const parser = code$("Create a parser.");
  // includes only "Prefer pure functions."
}
```

### Directory `AGENTS.md` Inheritance

Given this layout:

```text
project/
  AGENTS.md
  packages/
    AGENTS.md
    web/
      AGENTS.md
      src/app.ts
    api/
      src/server.ts
```

For `packages/web/src/app.ts`, effective directory context includes:

1. `project/AGENTS.md`
2. `project/packages/AGENTS.md`
3. `project/packages/web/AGENTS.md`

For `packages/api/src/server.ts`, effective directory context includes:

1. `project/AGENTS.md`
2. `project/packages/AGENTS.md`

`project/packages/web/AGENTS.md` does not apply to `packages/api/src/server.ts`
because it is not in that file's parent-directory chain.

## Static Resolution Requirements

Context used for compile-time generation should be statically resolvable.

If context cannot be resolved statically, implementations should follow plugin
configuration:

- strict mode: fail with an actionable diagnostic,
- lenient mode: leave unresolved call sites unchanged and emit warnings.

For plugin behavior details, see [CodeSpec Vite Plugin Spec](./plugin.spec.md).

## Relationship to Standard Library

This document formalizes scoping behavior for `context$` described in the
standard library.

See [CodeSpec Standard Library Spec](./stdlib.spec.md).
