/**
 * Context hash computation — SHA-256 of all RepoContext inputs for cache keying.
 */
import { createHash } from "node:crypto";
import type {
  ContentHash,
  DependencyInfo,
  DetectedFramework,
  TsconfigInfo,
} from "../types/index.js";

/**
 * Compute a deterministic SHA-256 hash of all RepoContext inputs.
 * This hash changes when any input that affects analysis results changes.
 */
export function computeContextHash(
  dependencies: Record<string, DependencyInfo>,
  frameworks: DetectedFramework[],
  tsconfig: TsconfigInfo,
): ContentHash {
  const hash = createHash("sha256");

  // Dependencies — sorted by name for determinism
  const sortedDeps = Object.entries(dependencies).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  for (const [name, info] of sortedDeps) {
    hash.update(`dep:${name}:${info.resolvedVersion ?? ""}:${info.declaredRange}`);
  }

  // Frameworks — sorted by id
  const sortedFrameworks = [...frameworks].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const fw of sortedFrameworks) {
    hash.update(`fw:${fw.id}:${fw.version}:${fw.confidence}`);
  }

  // Tsconfig
  if (tsconfig.baseUrl) hash.update(`baseUrl:${tsconfig.baseUrl}`);
  if (tsconfig.jsx) hash.update(`jsx:${tsconfig.jsx}`);
  if (tsconfig.paths) {
    const sortedPaths = Object.entries(tsconfig.paths).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    for (const [key, values] of sortedPaths) {
      hash.update(`path:${key}:${values.join(",")}`);
    }
  }

  return hash.digest("hex");
}
