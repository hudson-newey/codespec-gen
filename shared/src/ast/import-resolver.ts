import { resolve, dirname, isAbsolute } from "node:path";
import type { File, ImportDeclaration } from "@babel/types";

/** The only builtin that requires special compile-time handling (removal). */
export type BuiltinPromptBlock = "context$";

export type BindingType = BuiltinPromptBlock | "codespec-md";

/** Maps local identifier name → prompt block type */
export type BindingMap = Map<string, BindingType>;

/** For codespec-md bindings, maps local identifier name → absolute resolved path */
export type CodespecMdPaths = Map<string, string>;

/** Import paths that export context$ (both published and workspace forms). */
const CODESPEC_CONTEXT_PACKAGES = new Set([
  "codespec-gen/context",
  "@codespec/context",
]);

/**
 * Import paths that export stdlib CodeSpecs as .codespec.md-backed functions
 * (both published and workspace forms).
 */
const CODESPEC_STDLIB_PACKAGES = new Set([
  "codespec-gen/stdlib",
  "@codespec/stdlib",
]);

export interface ResolvedImports {
  bindings: BindingMap;
  /** local name → absolute codespec.md path (for codespec-md bindings) */
  codespecMdPaths: CodespecMdPaths;
}

/**
 * Resolve import bindings for CodeSpec-related imports in `ast`.
 *
 * @param resolveAbsolute - Optional sync resolver used to map specifiers to
 *   absolute paths. Required for stdlib named imports to be recognised as
 *   codespec-md bindings; without it those imports are silently skipped.
 */
export function resolveImports(
  ast: File,
  filePath: string,
  resolveAbsolute?: (specifier: string, importer: string) => string | null,
): ResolvedImports {
  const bindings: BindingMap = new Map();
  const codespecMdPaths: CodespecMdPaths = new Map();

  const importDecls = ast.program.body.filter(
    (node): node is ImportDeclaration => node.type === "ImportDeclaration",
  );

  for (const decl of importDecls) {
    const source = decl.source.value;

    // context$ — special compile-time directive: removed by the plugin.
    if (CODESPEC_CONTEXT_PACKAGES.has(source)) {
      for (const specifier of decl.specifiers) {
        if (
          specifier.type === "ImportSpecifier" &&
          (specifier.imported.type === "Identifier"
            ? specifier.imported.name
            : specifier.imported.value) === "context$"
        ) {
          bindings.set(specifier.local.name, "context$");
        }
      }
      continue;
    }

    // stdlib — named imports are backed by .codespec.md files. Resolve each
    // named export via "codespec-gen/stdlib/<name>" subpath and register it as a
    // codespec-md binding if a path can be resolved.
    if (CODESPEC_STDLIB_PACKAGES.has(source)) {
      for (const specifier of decl.specifiers) {
        if (specifier.type !== "ImportSpecifier") continue;
        const imported =
          specifier.imported.type === "Identifier"
            ? specifier.imported.name
            : specifier.imported.value;
        const local = specifier.local.name;
        const subpath = `codespec-gen/stdlib/${imported}`;
        const absPath = resolveAbsolute
          ? resolveAbsolute(subpath, filePath)
          : null;
        if (absPath) {
          bindings.set(local, "codespec-md");
          codespecMdPaths.set(local, absPath);
        }
      }
      continue;
    }

    // Local .codespec.md imports
    if (source.endsWith(".codespec.md")) {
      for (const specifier of decl.specifiers) {
        if (
          specifier.type === "ImportDefaultSpecifier" ||
          specifier.type === "ImportNamespaceSpecifier"
        ) {
          const local = specifier.local.name;
          bindings.set(local, "codespec-md");

          // Resolve to absolute path.
          // Relative paths are resolved directly from the importer's directory
          // so registry lookups (which use absolute paths) always hit correctly.
          // Absolute paths fall through to resolveAbsolute or are used as-is.
          let absPath: string;
          if (!isAbsolute(source)) {
            absPath = resolve(dirname(filePath), source);
          } else {
            absPath = resolveAbsolute
              ? (resolveAbsolute(source, filePath) ?? source)
              : source;
          }
          codespecMdPaths.set(local, absPath);
        }
      }
    }
  }

  return { bindings, codespecMdPaths };
}

