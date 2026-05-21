---
name: docs$
description: "Documentation generation helper that generates a JSDoc comment block before the following code element."
argument-hint: "usageContext?: string"
user-invocable: false
---

# docs$

Generate a JSDoc comment block for the code element that immediately follows
this call. The comment is inserted before the element at build time.

## Parameters

- `usageContext` (optional): Extra non-implementation context about when or
  where the code element is used (for example, a product flow description,
  ticket ID, or business context). Do not use this to describe how the code
  works — that should be inferred from the code itself.

## Generation Rules

- **Language/Environment**: JSDoc (compatible with TypeScript)
- **Behavior**: Analyse the code element that follows and generate an
  appropriate JSDoc block. Include:
  - A concise `@summary` or opening sentence describing what the element does.
  - `@param` tags for all parameters, with type and description.
  - A `@returns` tag if the element returns a non-void value.
  - The `usageContext` text, if provided, integrated naturally into the
    description (not as a raw copy-paste).
- **Performance**: Keep documentation concise and accurate; avoid padding.
- **Error Handling**: N/A

## Expected Output

Output ONLY the JSDoc comment block. The block must:

- Start with `/**`
- End with `*/`
- Not include the code element itself
- Not include Markdown code fences
- Not include any text outside the comment block

## Example

### Inputs

```json
{
  "usageContext": "Used by the public API endpoint for user profile updates (JIRA-1234)."
}
```

### Generated Code

```typescript
/**
 * Calculates tax for a given subtotal.
 *
 * Used by the public API endpoint for user profile updates (JIRA-1234).
 *
 * @param subtotal - The pre-tax amount.
 * @param taxRate - The tax rate as a decimal (for example, 0.08).
 * @returns The calculated tax amount.
 */
```
