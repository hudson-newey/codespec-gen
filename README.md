# CodeSpec

[CodeSpec Examples](./docs/examples.md)

## Usage

```sh
$ npm install codespec-gen
>
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { ollama } from "ai-sdk-ollama";
import codeSpecPlugin from "codespec-gen/vite-plugin";

export default defineConfig({
  plugins: [
    ...codeSpecPlugin({
      // CodeSpec uses Vercel's AI SDK to interface with any provider that
      // implements the standard interface.
      //
      // See the Vercel AI SDK for available providers and documentation on how
      // to implement your own:
      // https://github.com/vercel/ai/
      provider: ollama("gemma4"),
    }),
  ],
});
```

```ts
// main.ts
import { code$, guard$ } from "codespec-gen";

/**
 * @summary
 * Calculates the euclidean distance between two vectors
 *
 * @param vectorA - The first vector
 * @param vectorB - The second vector
 *
 * @returns
 * The euclidean distance between the two vectors
 */
export function euclideanDistance(
  vectorA: number[],
  vectorB: number[],
): number {
  guard$(`Ensure that both vectors are not empty.`, { throw: true });
  guard$(`Ensure that both vectors have the same length.`, { throw: true });

  return code$(
    `Calculate the euclidean distance between the following two vectors: ${vectorA} and ${vectorB}`,
  );
}
```

## IDE Integration

You can install the [VSCode extension](https://marketplace.visualstudio.com/items?itemName=codespec.vscode-codespec) to get inline code suggestions and documentation generation powered by LLMs.

With the IDE integration, all [CodeSpec](./docs/codespec.md) prompt blocks can be expanded via the arrow next to compiler functions e.g. `code$`, `context$`, etc...
Expanding the prompt block will show you the generated code with a 'Copy', 'Regenerate', and 'Inline' button.

When you hover over a `code$` block, the extension shows the function signature from the generated TypeScript output. This helps preserve strong TypeScript typing while iterating on generated functions before inlining.

To replace the CodeSpec function call with the generated code, you can use the 'inline' button found after expanding the generated code.

## Reducing API Costs

CodeSpec is designed to avoid unnecessary generation calls:

- Deterministic defaults: We use the lowest provider-supported temperature by default to reduce output drift and avoid avoidable re-generations.
- Keyed caching: Generated output is cached using prompt input, arguments, context, model, and generation settings.
- Committable artifacts: Generated TypeScript artifacts are written to `codespec_gen` so teams can commit and reuse them across machines and CI.
- Incremental reuse: Only changed inputs trigger new generation requests; unchanged call sites are served from cache/artifacts.

## Specifications

- [Vite Plugin Spec](./docs/plugin.spec.md)
- [CodeSpec Format Spec](./docs/codespec.spec.md)
- [CodeSpec Standard Library Spec](./docs/stdlib.spec.md)
- [CodeSpec Context Spec](./docs/context.spec.md)
- [VSCode Extension Spec](./docs/vscode-extension.spec.md)
