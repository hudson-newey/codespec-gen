import _code$ from "./code$.codespec.md";
import _guard$ from "./guard$.codespec.md";
import _docs$ from "./docs$.codespec.md";

/**
 * Primary code-generation primitive.
 *
 * Inlines generated TypeScript at the call site at build time via the
 * CodeSpec Vite plugin.
 *
 * @param instruction - A natural-language description of what to implement.
 */
export const code$ = _code$ as <T = unknown>(instruction: string) => T;

/**
 * Constraint and validation helper.
 *
 * Generates guard / validation statements at the call site at build time via
 * the CodeSpec Vite plugin.
 *
 * @param condition - A natural-language condition that must hold true.
 */
export const guard$ = _guard$ as (condition: string) => void;

/**
 * Documentation generation helper.
 *
 * Generates a JSDoc comment block before the following code element at build
 * time via the CodeSpec Vite plugin.
 *
 * @param usageContext - Optional extra context about when / where the code
 *   element is used.
 */
export const docs$ = _docs$ as (usageContext?: string) => void;
