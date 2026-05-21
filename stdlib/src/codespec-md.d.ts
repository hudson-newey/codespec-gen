/**
 * Ambient type declarations for .codespec.md module imports.
 *
 * At consumer build time, the CodeSpec Vite plugin resolves these imports and
 * replaces call sites with generated TypeScript. Without the plugin, the
 * bundler will fail to resolve .codespec.md files — this is intentional.
 */
declare module "*.codespec.md" {
  const spec: (...args: unknown[]) => unknown;
  export default spec;
}
