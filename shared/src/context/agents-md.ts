import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import * as path from "node:path";

/**
 * Given a source file path and the project root, compute the ordered list of
 * ancestor directories from root to the file's own directory, inclusive.
 *
 * Returns the contents of any AGENTS.md found in those directories,
 * in root-to-nearest order.
 */
export async function loadDirectoryContext(
  filePath: string,
  projectRoot: string,
): Promise<string[]> {
  const normalizedRoot = path.resolve(projectRoot);
  const normalizedFile = path.resolve(filePath);
  const fileDir = path.dirname(normalizedFile);

  // Build path chain from root to fileDir
  const rel = path.relative(normalizedRoot, fileDir);

  // If the file is outside the project root, only include root AGENTS.md
  const parts = rel.startsWith("..")
    ? []
    : rel === ""
      ? []
      : rel.split(path.sep);

  const dirs: string[] = [normalizedRoot];
  let current = normalizedRoot;
  for (const part of parts) {
    current = path.join(current, part);
    dirs.push(current);
  }

  const contents: string[] = [];
  for (const dir of dirs) {
    const agentsMdPath = path.join(dir, "AGENTS.md");
    if (existsSync(agentsMdPath)) {
      try {
        const content = await readFile(agentsMdPath, "utf-8");
        if (content.trim()) {
          contents.push(content.trim());
        }
      } catch {
        // Silently skip unreadable AGENTS.md files
      }
    }
  }

  return contents;
}
