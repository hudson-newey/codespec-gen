import MagicString from "magic-string";
import type { CallSite } from "@codespec/shared";
import type { File, Declaration, Statement } from "@babel/types";

/**
 * Apply all call-site rewrites to a MagicString in reverse source order
 * (to preserve byte offsets as we mutate the string).
 *
 * Expects `callSites` sorted ascending by `callStart`; processes them in
 * reverse so later offsets don't shift earlier ones.
 */
export function applyRewrites(
  ms: MagicString,
  callSites: CallSite[],
  generatedCode: Map<number, string>,
): void {
  const sorted = [...callSites].sort((a, b) => b.callStart - a.callStart);

  for (const site of sorted) {
    const generated = generatedCode.get(site.callStart);

    switch (site.type) {
      case "code$":
        // Replace the entire CallExpression with the generated expression
        ms.overwrite(site.callStart, site.callEnd, generated ?? "undefined");
        break;

      case "guard$": {
        // Replace the entire enclosing ExpressionStatement
        const stmtStart = site.statementStart ?? site.callStart;
        const stmtEnd = site.statementEnd ?? site.callEnd;
        ms.overwrite(stmtStart, stmtEnd, generated ?? "");
        break;
      }

      case "context$": {
        // Remove the entire ExpressionStatement (including trailing newline)
        const stmtStart = site.statementStart ?? site.callStart;
        const stmtEnd = site.statementEnd ?? site.callEnd;
        removeStatementWithTrailingWhitespace(ms, stmtStart, stmtEnd);
        break;
      }

      case "docs$": {
        // Remove the docs$ call statement and insert the JSDoc before the
        // statement start position (the next declaration follows immediately).
        const stmtStart = site.statementStart ?? site.callStart;
        const stmtEnd = site.statementEnd ?? site.callEnd;
        if (generated) {
          ms.overwrite(stmtStart, stmtEnd, generated);
        } else {
          removeStatementWithTrailingWhitespace(ms, stmtStart, stmtEnd);
        }
        break;
      }

      case "codespec-md":
        // Treat as a code$ expression replacement
        ms.overwrite(site.callStart, site.callEnd, generated ?? "undefined");
        break;
    }
  }
}

/**
 * Remove unused CodeSpec import specifiers.
 * If all specifiers in an import are unused, remove the entire declaration.
 */
export function removeUnusedImports(
  ms: MagicString,
  ast: File,
  usedBindings: Set<string>,
): void {
  // Iterate in reverse to preserve offsets
  const importDecls = ast.program.body
    .filter((n) => n.type === "ImportDeclaration")
    .reverse();

  for (const decl of importDecls) {
    if (decl.type !== "ImportDeclaration") continue;
    const source = decl.source.value;

    if (
      source !== "codespec-gen" &&
      !source.endsWith(".codespec.md")
    ) {
      continue;
    }

    const unusedSpecifiers = decl.specifiers.filter(
      (spec) => !usedBindings.has(spec.local.name),
    );

    if (unusedSpecifiers.length === decl.specifiers.length) {
      // All specifiers are unused — remove the entire import statement
      const start = decl.start ?? 0;
      const end = decl.end ?? 0;
      removeStatementWithTrailingWhitespace(ms, start, end);
    }
    // Partial removal (some specifiers still used) is intentionally not
    // attempted here — it would complicate the rewrite significantly for
    // a rare case. The whole import is kept if any specifier is still used.
  }
}

function removeStatementWithTrailingWhitespace(
  ms: MagicString,
  start: number,
  end: number,
): void {
  const original = ms.original;
  // Consume trailing whitespace and a single newline after the statement
  let actualEnd = end;
  while (actualEnd < original.length && original[actualEnd] === " ") {
    actualEnd++;
  }
  if (original[actualEnd] === "\n") {
    actualEnd++;
  }
  ms.remove(start, actualEnd);
}
