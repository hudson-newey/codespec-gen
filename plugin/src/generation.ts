import { generateText } from "ai";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { parseSource } from "@codespec/shared";
import type { BindingType } from "@codespec/shared";

export interface GenerationRequest {
  type: BindingType;
  /** Primary instruction text from the call site argument */
  instruction: string;
  /** Optional call-site keyword arguments (for .codespec.md calls) */
  callArgs?: Record<string, unknown>;
  /** Ordered effective context entries */
  effectiveContext: string[];
  /** Content of the .codespec.md file (only for codespec-md type) */
  codespecMdContent?: string;
  provider: LanguageModelV3;
}

const SYSTEM_PROMPTS: Record<string, string> = {
  code$: `You are a TypeScript code generator. Your output will be inlined at a call site as a TypeScript expression.
Rules:
- Output ONLY the TypeScript expression. No imports, no statements, no explanations, no markdown, no backticks.
- The output must be valid TypeScript that can be used as an expression.
- Do not include a trailing semicolon.
- Use existing type information from the surrounding code where possible.`,

  guard$: `You are a TypeScript validation code generator. Your output will be inlined as one or more TypeScript statements.
Rules:
- Output ONLY the TypeScript statement(s). No imports, no explanations, no markdown, no backticks.
- Typically generate an if-check that throws an Error when the condition is violated.
- End statements with semicolons.
- Do not wrap in a function.`,

  docs$: `You are a JSDoc documentation generator. Your output will be inserted directly before a code element.
Rules:
- Output ONLY the JSDoc comment block.
- Start with /** and end with */.
- Do not include code, explanations, or markdown outside the comment.
- Keep it concise but accurate.`,

  "codespec-md": `You are a TypeScript code generator executing a custom CodeSpec instruction file.
Rules:
- Output ONLY the TypeScript expression or statements appropriate for the call site context.
- No explanations, no markdown, no backticks.
- Follow the CodeSpec instructions precisely.`,
};

/**
 * Generate TypeScript code for a prompt block call site.
 * Uses temperature 0 (or lowest supported) for deterministic output.
 *
 * @throws {Error} If generation fails or output is not valid TypeScript.
 */
export async function generateCode(req: GenerationRequest): Promise<string> {
  const systemPrompt = buildSystemPrompt(req);
  const userPrompt = buildUserPrompt(req);

  let result: string;
  try {
    const response = await generateText({
      model: req.provider,
      temperature: 0,
      system: systemPrompt,
      prompt: userPrompt,
    });
    result = response.text.trim();
  } catch (err) {
    throw new Error(
      `CodeSpec generation failed for ${req.type} "${req.instruction}": ${String(err)}`,
    );
  }

  // Strip accidental markdown fences if the model ignores instructions
  result = stripMarkdownFences(result);

  // Validate output is parseable TypeScript
  validateTypeScript(result, req.type, req.instruction);

  return result;
}

function buildSystemPrompt(req: GenerationRequest): string {
  const basePrompt =
    req.type === "codespec-md" && req.codespecMdContent
      ? `${SYSTEM_PROMPTS["codespec-md"]}\n\n# CodeSpec Instructions\n\n${req.codespecMdContent}`
      : (SYSTEM_PROMPTS[req.type] ?? SYSTEM_PROMPTS["code$"]!);

  if (req.effectiveContext.length === 0) {
    return basePrompt;
  }

  const contextBlock = req.effectiveContext
    .map((entry, i) => `${i + 1}. ${entry}`)
    .join("\n");

  return `${basePrompt}\n\n# Context\n${contextBlock}`;
}

function buildUserPrompt(req: GenerationRequest): string {
  if (req.type === "codespec-md" && req.callArgs) {
    const argsBlock = JSON.stringify(req.callArgs, null, 2);
    return `Execute the CodeSpec with these arguments:\n${argsBlock}`;
  }

  switch (req.type) {
    case "code$":
      return `Generate TypeScript for: ${req.instruction}`;
    case "guard$":
      return `Generate a TypeScript validation check for: ${req.instruction}`;
    case "docs$":
      return `Generate JSDoc documentation${req.instruction ? ` with context: ${req.instruction}` : ""}.`;
    default:
      return req.instruction;
  }
}

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:typescript|ts|javascript|js)?\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();
}

function validateTypeScript(
  code: string,
  type: BindingType,
  instruction: string,
): void {
  // For docs$ we expect a comment, not TypeScript syntax — skip babel parse
  if (type === "docs$") {
    if (!code.startsWith("/**")) {
      throw new Error(
        `docs$ generation produced invalid output (expected JSDoc starting with /**) for: "${instruction}"`,
      );
    }
    return;
  }

  try {
    parseSource(code, "<generated>");
  } catch (err) {
    throw new Error(
      `CodeSpec generation produced invalid TypeScript for ${type} "${instruction}": ${String(err)}`,
    );
  }
}
