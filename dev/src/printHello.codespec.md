---
name: print-hello
description: "Generate TypeScript code that creates an HTML element whose text content is exactly Hello World!"
argument-hint: 'tagName?: string, className?: string'
user-invocable: true
---

# Print Hello Element

Generate a small TypeScript utility that creates and returns an HTML element with the text content set to Hello World!.

## Parameters

- `tagName`: `string` (optional). HTML tag name to create. Default: `"div"`.
- `className`: `string` (optional). CSS class name to apply to the created element.

## Generation Rules

- **Language/Environment**: TypeScript targeting browser DOM APIs.
- **Behavior**: Create an element using `document.createElement(tagName ?? "div")`, set `textContent` to `"Hello World!"`, optionally set `className` when provided, and return the element.
- **Performance/Complexity**: O(1) time and O(1) additional space.
- **Error Handling**: If `tagName` is an empty string after trimming, fall back to `"div"`.

## Expected Output

When invoked, output only implementation code in a single markdown code block.
The implementation should export one function named `createHelloElement` with this shape:

- Input: `{ tagName?: string; className?: string }`
- Output: `HTMLElement`

## Example

### Inputs

```json
{
  "tagName": "p",
  "className": "greeting"
}
```

### Generated Code

```typescript
export function createHelloElement(input: { tagName?: string; className?: string } = {}): HTMLElement {
  const normalizedTag = input.tagName?.trim() ? input.tagName.trim() : "div";
  const element = document.createElement(normalizedTag);
  element.textContent = "Hello World!";

  if (input.className) {
    element.className = input.className;
  }

  return element;
}
```
