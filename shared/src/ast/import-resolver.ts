import type { File, ImportDeclaration } from "@babel/types";

export type BuiltinPromptBlock =
  | "code$"
  | "guard$"
  | "context$"
  | "docs$";

export type BindingType = BuiltinPromptBlock | "codespec-md";

/** Maps local identifier name → prompt block type */
export type BindingMap = Map<string, BindingType>;

/** For codespec-md bindings, maps local identifier name → absolute resolved path */
export type CodespecMdPaths = Map<string, string>;

const CODESPEC_GEN_PACKAGE = "codespec-gen";
const BUILTIN_EXPORTS = new Set<string>([
  "code$",
  "guard$",
  "context$",
  "docs$",
]);

export interface ResolvedImports {
  bindings: BindingMap;
  /** local name → absolute codespec.md path (for codespec-md bindings) */
  codespecMdPaths: CodespecMdPaths;
}

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

    // Built-in codespec-gen package
    if (source === CODESPEC_GEN_PACKAGE) {
      for (const specifier of decl.specifiers) {
        if (specifier.type === "ImportSpecifier") {
          const imported =
            specifier.imported.type === "Identifier"
              ? specifier.imported.name
              : specifier.imported.value;
          const local = specifier.local.name;
          if (BUILTIN_EXPORTS.has(imported)) {
            bindings.set(local, imported as BuiltinPromptBlock);
          }
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

          // Resolve to absolute path if resolver provided, else store source
          const absPath = resolveAbsolute
            ? (resolveAbsolute(source, filePath) ?? source)
            : source;
          codespecMdPaths.set(local, absPath);
        }
      }
    }
  }

  return { bindings, codespecMdPaths };
}
