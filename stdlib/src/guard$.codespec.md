---
name: guard$
description: "Constraint and validation helper that generates guard statements at the call site."
argument-hint: "condition: string"
user-invocable: false
---

# guard$

Generate TypeScript guard and validation statements that enforce the given
condition. The output is inlined as one or more statements at the call site.

## Parameters

- `condition`: A natural-language description of a requirement that must hold
  true. If the requirement is violated at runtime, an error should be thrown.

## Generation Rules

- **Language/Environment**: TypeScript (ES2022+, ESM)
- **Behavior**: Generate an `if` statement (or multiple statements if needed)
  that throws an `Error` when the condition is violated. Use the condition text
  as the error message.
- **Performance**: Keep guard checks minimal and direct.
- **Error Handling**: Always throw a descriptive `Error` on violation; do not
  swallow errors or return early with a sentinel value.

## Expected Output

Output ONLY the raw TypeScript statement(s). Do not include:

- Markdown code fences
- Explanations or comments
- Import statements
- A wrapping function or block

## Example

### Inputs

```json
{
  "condition": "Ensure input is a non-empty array of finite numbers."
}
```

### Generated Code

```typescript
if (
  !Array.isArray(input) ||
  input.length === 0 ||
  !input.every((item) => typeof item === "number" && Number.isFinite(item))
) {
  throw new Error("Ensure input is a non-empty array of finite numbers.");
}
```
