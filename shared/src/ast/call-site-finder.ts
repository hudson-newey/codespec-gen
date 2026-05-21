import { walk } from "estree-walker";
import type { Node as EstreeNode } from "estree";
import type { File, Node, CallExpression, StringLiteral } from "@babel/types";
import type { BindingMap, BindingType } from "./import-resolver.js";
import { ScopeTracker, isScopeBoundary } from "./scope-tracker.js";

export interface CallSite {
  /** The binding type resolved for this call */
  type: BindingType;
  /** Local identifier name at call site */
  localName: string;
  /** String arguments passed to the call (only static string literals captured) */
  args: string[];
  /** Start offset of the CallExpression node */
  callStart: number;
  /** End offset of the CallExpression node */
  callEnd: number;
  /** Start offset of the enclosing ExpressionStatement (if applicable) */
  statementStart: number | null;
  /** End offset of the enclosing ExpressionStatement (if applicable) */
  statementEnd: number | null;
  /** Effective context$ entries visible at this call site */
  context: string[];
}

/**
 * Walk the AST and return all CodeSpec call sites with their effective
 * lexical context entries.
 *
 * Shadowing: if a local identifier name from `bindings` is re-declared in
 * an inner scope (VariableDeclarator, Parameter, etc.) that identifier is
 * removed from the active bindings within that scope.
 */
export function findCallSites(ast: File, bindings: BindingMap): CallSite[] {
  const results: CallSite[] = [];
  const tracker = new ScopeTracker();

  // Track which names are currently shadowed by inner declarations
  const shadowStack: Array<Set<string>> = [new Set()];

  function isActive(name: string): boolean {
    if (!bindings.has(name)) return false;
    for (const shadows of shadowStack) {
      if (shadows.has(name)) return false;
    }
    return true;
  }

  // Track the enclosing ExpressionStatement for each CallExpression
  const statementStack: Array<{ start: number; end: number } | null> = [null];

  // estree-walker requires @types/estree nodes; babel AST is structurally
  // compatible for traversal. We cast through unknown to satisfy the types.
  walk(ast as unknown as EstreeNode, {
    enter(estreeNode: EstreeNode) {
      // Use babel node type for all operations after this point
      const node = estreeNode as unknown as Node;

      if (isScopeBoundary(node)) {
        tracker.enterScope();
        shadowStack.push(new Set());
      }

      if (node.type === "ExpressionStatement") {
        statementStack.push({
          start: node.start ?? 0,
          end: node.end ?? 0,
        });
      }

      // Track variable/parameter shadowing
      if (
        node.type === "VariableDeclarator" &&
        node.id.type === "Identifier"
      ) {
        const name = node.id.name;
        if (bindings.has(name)) {
          shadowStack[shadowStack.length - 1]!.add(name);
        }
      }
      if (
        (node.type === "FunctionDeclaration" ||
          node.type === "FunctionExpression" ||
          node.type === "ArrowFunctionExpression") &&
        "params" in node
      ) {
        for (const param of node.params) {
          if (param.type === "Identifier" && bindings.has(param.name)) {
            shadowStack[shadowStack.length - 1]!.add(param.name);
          }
        }
      }

      if (node.type !== "CallExpression") return;

      const call = node as unknown as CallExpression;
      if (call.callee.type !== "Identifier") return;
      const calleeName = call.callee.name;

      if (!isActive(calleeName)) return;

      const bindingType = bindings.get(calleeName)!;
      const callStart = call.start ?? 0;
      const callEnd = call.end ?? 0;

      const enclosingStatement =
        statementStack[statementStack.length - 1] ?? null;

      // Handle context$ — record entries into tracker, will be removed later
      if (bindingType === "context$") {
        const contextArgs = extractStringArgs(call);
        for (const arg of contextArgs) {
          tracker.addContextEntry(arg, callStart);
        }
        // context$ call sites are still recorded so the rewriter can remove them
        results.push({
          type: "context$",
          localName: calleeName,
          args: contextArgs,
          callStart,
          callEnd,
          statementStart: enclosingStatement?.start ?? null,
          statementEnd: enclosingStatement?.end ?? null,
          context: [],
        });
        return;
      }

      const effectiveContext = tracker.effectiveContext();
      results.push({
        type: bindingType,
        localName: calleeName,
        args: extractStringArgs(call),
        callStart,
        callEnd,
        statementStart: enclosingStatement?.start ?? null,
        statementEnd: enclosingStatement?.end ?? null,
        context: [...effectiveContext],
      });
    },

    leave(estreeNode: EstreeNode) {
      const node = estreeNode as unknown as Node;

      if (node.type === "ExpressionStatement") {
        statementStack.pop();
      }

      if (isScopeBoundary(node)) {
        tracker.exitScope();
        shadowStack.pop();
      }
    },
  });

  return results;
}

function extractStringArgs(call: CallExpression): string[] {
  return call.arguments
    .filter((arg): arg is StringLiteral => arg.type === "StringLiteral")
    .map((arg) => arg.value);
}

