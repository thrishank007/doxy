/**
 * tsconfig.json parser — extract paths, baseUrl, and jsx settings.
 * Handles the `extends` chain by merging parent configs.
 */
import { readFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import type { TsconfigInfo } from "../types/index.js";

interface RawTsconfig {
  extends?: string;
  compilerOptions?: {
    paths?: Record<string, string[]>;
    baseUrl?: string;
    jsx?: string;
  };
}

/**
 * Read tsconfig.json and extract relevant fields.
 * Follows the `extends` chain to merge compiler options.
 */
export async function readTsconfig(root: string): Promise<TsconfigInfo> {
  const tsconfigPath = join(root, "tsconfig.json");
  try {
    const merged = await readTsconfigWithExtends(tsconfigPath);
    return {
      paths: merged.compilerOptions?.paths,
      baseUrl: merged.compilerOptions?.baseUrl,
      jsx: merged.compilerOptions?.jsx,
    };
  } catch {
    // No tsconfig or unreadable — return empty
    return {};
  }
}

/**
 * Recursively read a tsconfig and merge with its `extends` chain.
 * Child options override parent options.
 */
async function readTsconfigWithExtends(
  tsconfigPath: string,
  seen = new Set<string>(),
): Promise<RawTsconfig> {
  // Prevent infinite loops
  const normalizedPath = resolve(tsconfigPath);
  if (seen.has(normalizedPath)) return {};
  seen.add(normalizedPath);

  let raw: RawTsconfig;
  try {
    const content = await readFile(tsconfigPath, "utf-8");
    // Strip comments (JSON with comments support — tsconfig allows them)
    const stripped = stripJsonComments(content);
    raw = JSON.parse(stripped) as RawTsconfig;
  } catch {
    return {};
  }

  if (!raw.extends) return raw;

  // Resolve the extends path
  const dir = dirname(tsconfigPath);
  let parentPath: string;
  if (raw.extends.startsWith(".")) {
    parentPath = resolve(dir, raw.extends);
    // Add .json if missing
    if (!parentPath.endsWith(".json")) parentPath += ".json";
  } else {
    // Node module resolution — e.g., "@tsconfig/node18/tsconfig.json"
    // Try resolving from the directory
    try {
      parentPath = resolve(dir, "node_modules", raw.extends);
      if (!parentPath.endsWith(".json")) parentPath += ".json";
    } catch {
      return raw;
    }
  }

  const parent = await readTsconfigWithExtends(parentPath, seen);

  // Merge: child overrides parent
  return {
    compilerOptions: {
      ...parent.compilerOptions,
      ...raw.compilerOptions,
      // Paths need special merging — child completely overrides parent paths
    },
  };
}

/**
 * Strip single-line (//) and multi-line comments from JSON-with-comments.
 * tsconfig.json allows comments, but JSON.parse does not.
 */
function stripJsonComments(content: string): string {
  let result = "";
  let i = 0;
  let inString = false;
  let escape = false;

  while (i < content.length) {
    const ch = content[i]!;
    const next = content[i + 1];

    if (escape) {
      result += ch;
      escape = false;
      i++;
      continue;
    }

    if (inString) {
      if (ch === "\\") escape = true;
      if (ch === '"') inString = false;
      result += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inString = true;
      result += ch;
      i++;
      continue;
    }

    // Single-line comment
    if (ch === "/" && next === "/") {
      while (i < content.length && content[i] !== "\n") i++;
      continue;
    }

    // Multi-line comment
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < content.length && !(content[i] === "*" && content[i + 1] === "/")) i++;
      i += 2; // skip */
      continue;
    }

    // Trailing commas — replace with space to keep positions
    result += ch;
    i++;
  }

  // Handle trailing commas before } or ]
  return result.replace(/,\s*([\]}])/g, "$1");
}
