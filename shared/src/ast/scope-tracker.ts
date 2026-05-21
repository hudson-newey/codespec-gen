/** A single scope frame collecting context$ arguments added in that scope */
interface ScopeFrame {
  /** context$ string arguments collected in this scope, in appearance order */
  entries: string[];
  /** call-site offsets processed so far in this scope (start position of call) */
  processedCallOffsets: Set<number>;
}

export interface CallSiteContext {
  /** Ordered context entries visible at this call site (outer → inner, pre-call) */
  entries: string[];
}

/**
 * Tracks lexical scope during AST traversal and computes the effective
 * context$ entries visible at each call site.
 *
 * Usage:
 *   const tracker = new ScopeTracker();
 *   // On entering scope nodes:
 *   tracker.enterScope();
 *   // When encountering a context$ call at position `pos`:
 *   tracker.addContextEntry("some context string", pos);
 *   // When computing effective context for a call site at position `pos`:
 *   const ctx = tracker.effectiveContext(pos);
 *   // On leaving scope nodes:
 *   tracker.exitScope();
 */
export class ScopeTracker {
  private stack: ScopeFrame[] = [{ entries: [], processedCallOffsets: new Set() }];

  enterScope(): void {
    this.stack.push({ entries: [], processedCallOffsets: new Set() });
  }

  exitScope(): void {
    if (this.stack.length > 1) {
      this.stack.pop();
    }
  }

  /**
   * Record a context$ string argument at the given call site start offset.
   * The offset is used to preserve appearance order and avoid re-processing.
   */
  addContextEntry(value: string, callOffset: number): void {
    const frame = this.currentFrame();
    if (!frame.processedCallOffsets.has(callOffset)) {
      frame.processedCallOffsets.add(callOffset);
      frame.entries.push(value);
    }
  }

  /**
   * Returns all context$ entries visible at the current scope position,
   * from outermost to innermost scope (pre-call order is maintained within
   * each frame because entries are added as we traverse).
   */
  effectiveContext(): string[] {
    return this.stack.flatMap((frame) => frame.entries);
  }

  private currentFrame(): ScopeFrame {
    return this.stack[this.stack.length - 1]!;
  }
}

/** Node types that introduce a new lexical scope */
export function isScopeBoundary(node: { type: string }): boolean {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression" ||
    node.type === "BlockStatement" ||
    node.type === "ForStatement" ||
    node.type === "ForInStatement" ||
    node.type === "ForOfStatement" ||
    node.type === "WhileStatement" ||
    node.type === "DoWhileStatement" ||
    node.type === "IfStatement" ||
    node.type === "SwitchStatement" ||
    node.type === "TryStatement" ||
    node.type === "ClassDeclaration" ||
    node.type === "ClassExpression"
  );
}
