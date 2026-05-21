/**
 * Shared prompt context helper.
 *
 * Provides background assumptions, constraints, or domain information that
 * influences nearby `code$` and `guard$` call sites within the same
 * lexical scope.
 *
 * This call is removed entirely by the CodeSpec Vite plugin at build time.
 * The stub is a no-op and safe to call in environments without the plugin.
 *
 * @param context - One or more background assumptions or constraints.
 */
export function context$(..._context: unknown[]): void {
  // Intentional no-op. The CodeSpec Vite plugin removes this call at build
  // time and uses the arguments as context for nearby code$ / guard$ calls.
}
