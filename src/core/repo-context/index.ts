/**
 * Repo Context Builder — reads package.json, lockfile, tsconfig
 * and produces a complete RepoContext.
 */
import { resolve } from "node:path";
import type { DoxyConfig, RepoContext } from "../types/index.js";
import { detectPackageManager, detectFrameworks } from "./detect.js";
import {
  readAndParseNpmLockfile,
  readAndParsePnpmLockfile,
  readAndParseYarnLockfile,
  type ResolvedVersions,
} from "./lockfile.js";
import { readManifest, buildDependencyMap } from "./manifest.js";
import { readTsconfig } from "./tsconfig.js";
import { computeContextHash } from "./hash.js";

/**
 * Build the complete RepoContext for a project root.
 *
 * Steps:
 * 1. Read package.json for declared dependency ranges
 * 2. Detect package manager and parse lockfile for resolved versions
 * 3. Merge into dependency map
 * 4. Detect frameworks from dependencies (with optional config overrides)
 * 5. Read tsconfig.json for path aliases and JSX mode
 * 6. Compute context hash for cache keying
 */
export async function buildRepoContext(
  root: string,
  config?: Partial<DoxyConfig>,
): Promise<RepoContext> {
  const absoluteRoot = resolve(root);

  // 1. Read package.json
  const manifest = await readManifest(absoluteRoot);

  // 2. Detect PM and parse lockfile
  const { pm, lockfilePath } = await detectPackageManager(absoluteRoot);
  let resolvedVersions: ResolvedVersions = {};

  if (lockfilePath) {
    resolvedVersions = await parseLockfileByType(pm, lockfilePath);
  }

  // 3. Build dependency map
  const dependencies = buildDependencyMap(manifest, resolvedVersions);

  // 4. Detect frameworks
  const frameworks = detectFrameworks(dependencies, config?.frameworks);

  // 5. Read tsconfig
  const tsconfig = await readTsconfig(absoluteRoot);

  // 6. Compute context hash
  const contextHash = computeContextHash(dependencies, frameworks, tsconfig);

  return {
    root: absoluteRoot,
    packageManager: pm,
    dependencies,
    frameworks,
    tsconfig,
    contextHash,
  };
}

async function parseLockfileByType(
  pm: string,
  lockfilePath: string,
): Promise<ResolvedVersions> {
  switch (pm) {
    case "npm":
      return readAndParseNpmLockfile(lockfilePath);
    case "pnpm":
      return readAndParsePnpmLockfile(lockfilePath);
    case "yarn":
      return readAndParseYarnLockfile(lockfilePath);
    default:
      return {};
  }
}

// Re-export submodules for direct access
export { detectPackageManager, detectFrameworks } from "./detect.js";
export {
  parseNpmLockfile,
  parsePnpmLockfile,
  parseYarnLockfile,
  type ResolvedVersions,
} from "./lockfile.js";
export { readManifest, buildDependencyMap } from "./manifest.js";
export { readTsconfig } from "./tsconfig.js";
export { computeContextHash } from "./hash.js";
