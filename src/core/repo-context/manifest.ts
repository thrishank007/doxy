/**
 * Manifest reader — parse package.json for dependency declarations.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DependencyInfo, SemverString } from "../types/index.js";
import type { ResolvedVersions } from "./lockfile.js";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Read and parse package.json, returning declared dependency ranges.
 */
export async function readManifest(root: string): Promise<PackageJson> {
  const content = await readFile(join(root, "package.json"), "utf-8");
  return JSON.parse(content) as PackageJson;
}

/**
 * Build the dependency map by merging declared ranges from package.json
 * with resolved versions from the lockfile.
 *
 * Dependencies from both `dependencies` and `devDependencies` are included,
 * since devDependencies may import libraries that doxy should check
 * (e.g., testing utilities from @testing-library/react).
 */
export function buildDependencyMap(
  manifest: PackageJson,
  resolvedVersions: ResolvedVersions,
): Record<string, DependencyInfo> {
  const deps: Record<string, DependencyInfo> = {};

  const allDeclared: Record<string, string> = {
    ...manifest.devDependencies,
    ...manifest.dependencies, // dependencies override devDependencies on conflict
  };

  for (const [name, declaredRange] of Object.entries(allDeclared)) {
    const resolvedVersion: SemverString | undefined = resolvedVersions[name];
    deps[name] = { resolvedVersion, declaredRange };
  }

  return deps;
}
