import { generateText } from "ai";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { parseSource } from "../../shared/src/index.js";
import type { BindingType } from "../../shared/src/index.js";

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

const SYSTEM_PROMPTS = {
  "codespec-md": `You are a TypeScript code generator executing a CodeSpec instruction file.
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
  const basePrompt = req.codespecMdContent
    ? `${SYSTEM_PROMPTS["codespec-md"]}\n\n# CodeSpec Instructions\n\n${req.codespecMdContent}`
    : SYSTEM_PROMPTS["codespec-md"];

  if (req.effectiveContext.length === 0) {
    return basePrompt;
  }

  const contextBlock = req.effectiveContext
    .map((entry, i) => `${i + 1}. ${entry}`)
    .join("\n");

  return `${basePrompt}\n\n# Context\n${contextBlock}`;
}

function buildUserPrompt(req: GenerationRequest): string {
  if (req.callArgs) {
    const argsBlock = JSON.stringify(req.callArgs, null, 2);
    return `Execute the CodeSpec with these arguments:\n${argsBlock}`;
  }
  return req.instruction;
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
  // JSDoc output: validate it starts with /** rather than trying to parse it
  // as TypeScript.
  if (code.trimStart().startsWith("/**")) {
    if (!code.includes("*/")) {
      throw new Error(
        `CodeSpec generation produced invalid JSDoc for "${instruction}": missing closing */`,
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
