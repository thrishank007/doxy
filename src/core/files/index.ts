import { readdir } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import picomatch from "picomatch";

const SUPPORTED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

export interface CollectSourceFilesOptions {
  root: string;
  include: string[];
  exclude: string[];
  explicitFiles?: string[];
}

export async function collectSourceFiles(
  options: CollectSourceFilesOptions,
): Promise<string[]> {
  if (options.explicitFiles && options.explicitFiles.length > 0) {
    return options.explicitFiles.map((file) => resolve(options.root, file));
  }

  const allFiles = await walkFiles(options.root);
  const includeMatchers = options.include.map((pattern) => picomatch(pattern));
  const excludeMatchers = options.exclude.map((pattern) => picomatch(pattern));

  return allFiles
    .filter((file) => SUPPORTED_EXTENSIONS.has(extname(file)))
    .filter((file) => {
      const normalized = toProjectRelative(options.root, file);
      const included = includeMatchers.length === 0
        ? true
        : includeMatchers.some((matcher) => matcher(normalized));
      const excluded = excludeMatchers.some((matcher) => matcher(normalized));
      return included && !excluded;
    })
    .sort();
}

async function walkFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = resolve(root, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") {
          return [];
        }
        return walkFiles(absolutePath);
      }
      return [absolutePath];
    }),
  );

  return files.flat();
}

export function toProjectRelative(root: string, file: string): string {
  return relative(root, file).split(sep).join("/");
}
