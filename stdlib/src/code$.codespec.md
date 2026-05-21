---
name: code$
description: "Primary code-generation primitive that inlines generated TypeScript at the call site."
argument-hint: "instruction: string"
user-invocable: false
---

# code$

Generate TypeScript code that implements the given natural-language instruction.
The output is inlined directly at the call site as a TypeScript expression.

## Parameters

- `instruction`: A natural-language description of what should be implemented.

## Generation Rules

- **Language/Environment**: TypeScript (ES2022+, ESM)
- **Behavior**: Output a single TypeScript expression that implements the
  instruction. The expression must be usable as the right-hand side of an
  assignment or as a standalone value.
- **Performance**: Prefer idiomatic, readable TypeScript; avoid unnecessary
  allocations.
- **Error Handling**: Do not add error handling unless the instruction
  explicitly requests it.

## Expected Output

Output ONLY the raw TypeScript expression. Do not include:

- Variable declarations (`const`, `let`, `var`)
- Import statements
- A trailing semicolon
- Markdown code fences
- Explanations or comments

## Example

### Inputs

```json
{
  "instruction": "Normalize a string to kebab-case and remove non-alphanumeric characters"
}
```

### Generated Code

```typescript
text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
```
