import { parse } from "@babel/parser";
import type { File } from "@babel/types";

export function parseSource(code: string, filePath: string): File {
  return parse(code, {
    sourceType: "module",
    sourceFilename: filePath,
    strictMode: false,
    plugins: [
      "typescript",
      "importAssertions",
      "importAttributes",
      "jsx",
    ],
    errorRecovery: true,
  });
}
