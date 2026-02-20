/**
 * Package manager detection and framework detection.
 */
import { access } from "node:fs/promises";
import { join } from "node:path";
import type {
  PackageManager,
  DetectedFramework,
  DependencyInfo,
  DetectionConfidence,
} from "../types/index.js";

// ─── Package Manager Detection ──────────────────────────────────

const LOCKFILES: Array<{ file: string; pm: PackageManager }> = [
  { file: "pnpm-lock.yaml", pm: "pnpm" },
  { file: "yarn.lock", pm: "yarn" },
  { file: "package-lock.json", pm: "npm" },
];

/**
 * Detect which package manager is in use by checking for lockfile presence.
 * Checks in priority order: pnpm → yarn → npm.
 * Falls back to "npm" if no lockfile found.
 */
export async function detectPackageManager(
  root: string,
): Promise<{ pm: PackageManager; lockfilePath: string | undefined }> {
  for (const { file, pm } of LOCKFILES) {
    const lockfilePath = join(root, file);
    try {
      await access(lockfilePath);
      return { pm, lockfilePath };
    } catch {
      // Not found, try next
    }
  }
  return { pm: "npm", lockfilePath: undefined };
}

// ─── Framework Detection ────────────────────────────────────────

interface FrameworkRule {
  id: string;
  name: string;
  /** Primary package to detect */
  package: string;
  /** Additional packages that confirm the framework */
  companions?: string[];
}

const FRAMEWORK_RULES: FrameworkRule[] = [
  { id: "nextjs", name: "Next.js", package: "next" },
  { id: "react", name: "React", package: "react", companions: ["react-dom"] },
];

/**
 * Detect frameworks from the dependency map.
 * Returns frameworks sorted by specificity (more specific first — e.g., Next.js before React).
 */
export function detectFrameworks(
  dependencies: Record<string, DependencyInfo>,
  configOverrides?: Record<string, string>,
): DetectedFramework[] {
  const frameworks: DetectedFramework[] = [];

  for (const rule of FRAMEWORK_RULES) {
    // Check config overrides first
    if (configOverrides?.[rule.id]) {
      frameworks.push({
        id: rule.id,
        name: rule.name,
        version: configOverrides[rule.id]!,
        confidence: "manifest" as DetectionConfidence,
      });
      continue;
    }

    const dep = dependencies[rule.package];
    if (!dep) continue;

    const version = dep.resolvedVersion ?? dep.declaredRange.replace(/^[\^~>=<\s]+/, "");
    const confidence: DetectionConfidence = dep.resolvedVersion ? "lockfile" : "manifest";

    frameworks.push({
      id: rule.id,
      name: rule.name,
      version,
      confidence,
    });
  }

  return frameworks;
}
