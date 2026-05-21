# CodeSpec Standard Library Specification

The CodeSpec standard library is a collection of commonly used CodeSpecs that can be imported and used in your project.

Each CodeSpec in the standard library is a regular [CodeSpec](./codespec.spec.md) file that can be imported and used like any normal TypeScript/JavaScript module.

## Usage

```ts
import { code$, guard$, context$, docs$ } from "codespec-gen";
```

## Available CodeSpecs

### `code$`

Primary code-generation primitive.

#### Parameters

- `instruction: string` (required): A natural-language instruction describing what should be implemented.

Use `code$` when you want to describe _what_ should be implemented and let the compiler inline generated code at the call site.

#### Example Input

```ts
const value = code$(
  "Normalize this string to kebab-case and remove non-alphanumeric characters.",
);
```

#### Example Output

```ts
const value =
  "normalize-this-string-to-kebab-case-and-remove-non-alphanumeric-characters";
```

### `guard$`

Constraint and validation helper.

#### Parameters

- `condition: string` (required): A natural-language requirement that must hold true.

Use `guard$` to define requirements that must hold for the surrounding code path. This is useful for preconditions, shape checks, and safety rules.

#### Example Input

```ts
export function normalizeScores(input: unknown): number[] {
  guard$("Ensure input is an array.");
  guard$("Ensure input is a non-empty array of finite numbers.");

  return (input as number[]).map((value) => Number(value));
}
```

#### Example Output

```ts
export function normalizeScores(input: unknown): number[] {
  if (!Array.isArray(input)) {
    throw new Error("Ensure input is an array.");
  }

  if (
    input.length === 0 ||
    !input.every((item) => typeof item === "number" && Number.isFinite(item))
  ) {
    throw new Error("Ensure input is a non-empty array of finite numbers.");
  }

  return input.map((value) => Number(value));
}
```

### `context$`

Shared prompt context helper.

#### Parameters

- `...context: string[]` (optional): One or more background assumptions or constraints that should influence nearby generated code.

Use `context$` to provide background assumptions, constraints, or domain information that should influence nearby `code$` and `guard$` blocks.

`context$` only applies to the current JavaScript scope. Once execution leaves that scope (for example, when a function returns), the context is no longer applied.

#### Example Input

```ts
context$(
  "Target environment is Node.js 20 with ESM modules.",
  "Prefer pure functions and avoid external dependencies.",
);

const slug = code$("Create a slug from a title string.");
```

#### Example Output

```ts
const slug = createSlug(title);
```

#### Example Input (Using an Imported TypeScript Function & File)

```ts
// The ?raw suffix is a Vite native feature that imports the file as a string.
// We can use this feature to import an entire file as context for nearby
// CodeSpec blocks.
// https://vite.dev/guide/assets#importing-asset-as-string
import readmeContent from "./README.md?raw";
import { getProjectContext } from "./project-context.ts";

context$(getProjectContext);
context$(readmeContent);

const adapter = code$("Create a fetch-based HTTP adapter for our API client.");
```

### `docs$`

Documentation generation helper.

#### Parameters

- `usageContext?: string` (optional): Extra non-implementation context about when or where the code is used (for example, product flow, ticket ID, or business context).

Use `docs$` when you want generated comments or documentation for code elements such as functions, classes, and modules.

The parameter is optional. If provided, it should describe when or where the documented code is used, or include extra non-implementation context. The parameter should not restate how to write the JSDoc itself.

#### Example Input

```ts
docs$("Used by the public API endpoint for user profile updates (JIRA-1234).");

export function calculateTax(subtotal: number, taxRate: number): number {
  return subtotal * taxRate;
}
```

#### Example Output

```ts
/**
 * Calculates tax for a given subtotal.
 *
 * Used by the public API endpoint for user profile updates (JIRA-1234).
 *
 * @param {number} subtotal - The pre-tax amount.
 * @param {number} taxRate - The tax rate as a decimal (for example, 0.08).
 * @returns {number} The calculated tax amount.
 */
export function calculateTax(subtotal: number, taxRate: number): number {
  return subtotal * taxRate;
}
```
