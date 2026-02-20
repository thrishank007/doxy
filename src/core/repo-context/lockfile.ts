/**
 * Lockfile parsers — extract package→resolved version mappings
 * from npm, pnpm, and yarn lockfiles.
 */
import { readFile } from "node:fs/promises";
import type { SemverString } from "../types/index.js";

/** Resolved versions keyed by package name */
export type ResolvedVersions = Record<string, SemverString>;

// ─── npm (package-lock.json v2/v3) ──────────────────────────────

interface NpmLockfileV2 {
  lockfileVersion?: number;
  packages?: Record<string, { version?: string }>;
  dependencies?: Record<string, { version?: string }>;
}

/**
 * Parse package-lock.json (npm v2/v3 format preferred, v1 fallback).
 *
 * v2/v3 uses `packages` with keys like `node_modules/react`.
 * v1 uses `dependencies` with keys like `react`.
 */
export function parseNpmLockfile(content: string): ResolvedVersions {
  const lock = JSON.parse(content) as NpmLockfileV2;
  const versions: ResolvedVersions = {};

  // Prefer v2/v3 packages field
  if (lock.packages) {
    for (const [key, entry] of Object.entries(lock.packages)) {
      if (!key || !entry.version) continue;
      // Keys look like "node_modules/react" or "node_modules/@scope/pkg"
      // Also nested: "node_modules/foo/node_modules/bar"
      // We want the top-level ones (one `node_modules/` prefix)
      const name = extractPackageName(key);
      if (name && !versions[name]) {
        versions[name] = entry.version;
      }
    }
    return versions;
  }

  // Fallback to v1 dependencies field
  if (lock.dependencies) {
    for (const [name, entry] of Object.entries(lock.dependencies)) {
      if (entry.version) {
        versions[name] = entry.version;
      }
    }
  }

  return versions;
}

/**
 * Extract package name from a `packages` key.
 * "node_modules/react" → "react"
 * "node_modules/@scope/pkg" → "@scope/pkg"
 * "" (root) → undefined
 * Nested deps (multiple node_modules/) → take the last segment
 */
function extractPackageName(key: string): string | undefined {
  if (!key.includes("node_modules/")) return undefined;
  const lastIdx = key.lastIndexOf("node_modules/");
  const rest = key.slice(lastIdx + "node_modules/".length);
  if (!rest) return undefined;
  // Scoped packages: @scope/name
  if (rest.startsWith("@")) {
    const slashIdx = rest.indexOf("/", 1);
    if (slashIdx === -1) return rest;
    const secondSlash = rest.indexOf("/", slashIdx + 1);
    return secondSlash === -1 ? rest : rest.slice(0, secondSlash);
  }
  // Unscoped: take up to first /
  const slashIdx = rest.indexOf("/");
  return slashIdx === -1 ? rest : rest.slice(0, slashIdx);
}

// ─── pnpm (pnpm-lock.yaml) ──────────────────────────────────────

/**
 * Parse pnpm-lock.yaml.
 *
 * We use a lightweight line-based parser to avoid a YAML dependency.
 * pnpm lockfile v6+ uses `packages:` with keys like `/@scope/pkg@version`
 * or `/pkg@version`. Newer v9 uses `packages:` with `pkg@version:` keys.
 *
 * We also look at the `importers:` or `dependencies:` section for
 * the root project's resolved versions.
 */
export function parsePnpmLockfile(content: string): ResolvedVersions {
  const versions: ResolvedVersions = {};
  const lines = content.split("\n");

  let inSection: "dependencies" | "devDependencies" | "importers-deps" | "packages" | null = null;
  let baseIndent = 0;
  let importerDepIndent = 0;
  let inRootImporter = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;

    // Top-level sections (no indent or indent 0)
    if (indent === 0 && trimmed.startsWith("dependencies:")) {
      inSection = "dependencies";
      baseIndent = 0;
      continue;
    }
    if (indent === 0 && trimmed.startsWith("devDependencies:")) {
      inSection = "devDependencies";
      baseIndent = 0;
      continue;
    }
    if (indent === 0 && trimmed.startsWith("packages:")) {
      inSection = "packages";
      baseIndent = 0;
      continue;
    }
    if (indent === 0 && trimmed.startsWith("importers:")) {
      inSection = null;
      inRootImporter = false;
      // Look for '.:' as the root importer
      const nextLine = lines[i + 1];
      if (nextLine) {
        const nextTrimmed = nextLine.trimStart();
        if (nextTrimmed.startsWith(".:") || nextTrimmed.startsWith("'.':")) {
          inRootImporter = true;
        }
      }
      continue;
    }

    // If we hit a new top-level key, reset
    if (indent === 0 && trimmed.includes(":")) {
      inSection = null;
      inRootImporter = false;
      continue;
    }

    // Root importer dependencies/devDependencies
    if (inRootImporter && indent > 0) {
      if (trimmed.startsWith("dependencies:") || trimmed.startsWith("devDependencies:")) {
        inSection = "importers-deps";
        importerDepIndent = indent;
        continue;
      }
      // If we're inside importer deps
      if (inSection === "importers-deps" && indent > importerDepIndent) {
        const depMatch = trimmed.match(/^['"]?([^'":\s]+)['"]?:\s*$/);
        if (depMatch) {
          const pkgName = depMatch[1]!;
          // Look ahead for `version:` line (may be after `specifier:` line)
          for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
            const ahead = lines[j]!.trimStart();
            const aheadIndent = lines[j]!.length - ahead.length;
            // Stop if we've left this dep's block
            if (aheadIndent <= indent && ahead !== "") break;
            const vMatch = ahead.match(/^version:\s*['"]?([^'"(\s]+)/);
            if (vMatch && vMatch[1]) {
              versions[pkgName] = cleanPnpmVersion(vMatch[1]);
              break;
            }
          }
        }
        continue;
      }
    }

    // Top-level dependencies/devDependencies (older pnpm format)
    if ((inSection === "dependencies" || inSection === "devDependencies") && indent > baseIndent) {
      // Format: "  react: 18.2.0" or "  react: ^18.2.0" or "'react': 18.2.0"
      const depMatch = trimmed.match(/^['"]?([^'":\s]+)['"]?:\s*['"]?([^\s'"]+)/);
      if (depMatch && depMatch[1] && depMatch[2]) {
        const name = depMatch[1];
        const version = cleanPnpmVersion(depMatch[2]);
        // Only store if it looks like a resolved version (x.y.z)
        if (/^\d+\.\d+\.\d+/.test(version)) {
          versions[name] = version;
        }
      }
      continue;
    }

    // Packages section — extract versions from package keys
    if (inSection === "packages" && indent > baseIndent) {
      // v6+: "  /react@18.2.0:" or "  /@scope/pkg@1.0.0:"
      // v9:  "  react@18.2.0:" or "  '@scope/pkg@1.0.0':"
      const pkgMatch = trimmed.match(/^['"]?\/?(@?[^@'"]+)@(\d+\.[^'":(\s]+)/);
      if (pkgMatch && pkgMatch[1] && pkgMatch[2]) {
        const name = pkgMatch[1];
        const version = cleanPnpmVersion(pkgMatch[2]);
        if (!versions[name]) {
          versions[name] = version;
        }
      }
    }
  }

  return versions;
}

function cleanPnpmVersion(version: string): string {
  // pnpm may include peer dep suffixes like "18.2.0(react@18.2.0)"
  // or parenthesized info — strip it
  const parenIdx = version.indexOf("(");
  const cleaned = parenIdx === -1 ? version : version.slice(0, parenIdx);
  return cleaned.replace(/['"]/g, "").trim();
}

// ─── yarn (yarn.lock v1) ────────────────────────────────────────

/**
 * Parse yarn.lock (v1 format — the most common).
 *
 * Format:
 *   react@^18.0.0:
 *     version "18.2.0"
 *     resolved "..."
 *
 * Or with quotes:
 *   "react@^18.0.0":
 *     version "18.2.0"
 */
export function parseYarnLockfile(content: string): ResolvedVersions {
  const versions: ResolvedVersions = {};
  const lines = content.split("\n");

  let currentPackages: string[] = [];

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith("#") || line.trim() === "") continue;

    // Entry header line (not indented)
    if (!line.startsWith(" ") && !line.startsWith("\t")) {
      currentPackages = parseYarnEntryHeader(line);
      continue;
    }

    // Version line (indented)
    if (currentPackages.length > 0) {
      const versionMatch = line.match(/^\s+version\s+"([^"]+)"/);
      if (versionMatch && versionMatch[1]) {
        for (const pkg of currentPackages) {
          if (!versions[pkg]) {
            versions[pkg] = versionMatch[1];
          }
        }
        currentPackages = [];
      }
    }
  }

  return versions;
}

/**
 * Parse the header line of a yarn.lock entry.
 * Can be: `react@^18.0.0:` or `"react@^18.0.0":` or `react@^18.0.0, react@^18.2.0:`
 * Returns the package names (without version specifiers).
 */
function parseYarnEntryHeader(line: string): string[] {
  // Strip trailing colon
  const cleaned = line.replace(/:$/, "").trim();
  // Split by ", " for multi-version entries
  const parts = cleaned.split(/,\s*/);
  const names: string[] = [];

  for (const part of parts) {
    // Strip quotes
    const unquoted = part.replace(/^"|"$/g, "");
    // Find package name: everything before the last @version
    // "@scope/pkg@^1.0.0" → "@scope/pkg"
    // "pkg@^1.0.0" → "pkg"
    const name = extractYarnPackageName(unquoted);
    if (name && !names.includes(name)) {
      names.push(name);
    }
  }

  return names;
}

function extractYarnPackageName(entry: string): string | undefined {
  // Scoped: @scope/name@version
  if (entry.startsWith("@")) {
    const secondAt = entry.indexOf("@", 1);
    return secondAt === -1 ? undefined : entry.slice(0, secondAt);
  }
  // Unscoped: name@version
  const atIdx = entry.indexOf("@");
  return atIdx === -1 ? undefined : entry.slice(0, atIdx);
}

// ─── File reader helpers ─────────────────────────────────────────

export async function readAndParseNpmLockfile(
  path: string,
): Promise<ResolvedVersions> {
  const content = await readFile(path, "utf-8");
  return parseNpmLockfile(content);
}

export async function readAndParsePnpmLockfile(
  path: string,
): Promise<ResolvedVersions> {
  const content = await readFile(path, "utf-8");
  return parsePnpmLockfile(content);
}

export async function readAndParseYarnLockfile(
  path: string,
): Promise<ResolvedVersions> {
  const content = await readFile(path, "utf-8");
  return parseYarnLockfile(content);
}
