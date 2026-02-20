/**
 * Authority Store — loads curated API spec data and provides
 * version-aware queries.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import * as semver from "semver";
import {
  AuthorityManifestSchema,
  AuthorityDataFileSchema,
} from "../core/types/schemas.js";
import type {
  ApiSpec,
  AuthorityManifest,
  AuthorityStore,
  ContentHash,
  DeprecationEntry,
  ResolvedApiSpec,
  SemverString,
  SignatureSpec,
} from "../core/types/index.js";

/**
 * In-memory implementation of the AuthorityStore interface.
 * Loads JSON data files and builds a Map for O(1) lookups.
 */
export class InMemoryAuthorityStore implements AuthorityStore {
  /** Map<"package/export", ApiSpec> */
  private specs: Map<string, ApiSpec>;
  private packages: Set<string>;
  private hash: ContentHash;
  private version: SemverString;

  constructor(
    specs: Map<string, ApiSpec>,
    packages: Set<string>,
    hash: ContentHash,
    version: SemverString,
  ) {
    this.specs = specs;
    this.packages = packages;
    this.hash = hash;
    this.version = version;
  }

  getApiSpec(
    packageName: string,
    exportName: string,
    installedVersion: SemverString,
  ): ResolvedApiSpec | undefined {
    const key = `${packageName}/${exportName}`;
    const spec = this.specs.get(key);
    if (!spec) return undefined;

    const available = isAvailable(spec, installedVersion);
    const isFuture = !available && isFutureApi(spec, installedVersion);
    const activeSignature = findActiveSignature(spec, installedVersion);
    const activeDeprecation = findActiveDeprecation(spec, installedVersion);

    return {
      spec,
      activeSignature,
      activeDeprecation,
      available,
      isFuture,
    };
  }

  contentHash(): ContentHash {
    return this.hash;
  }

  dataVersion(): SemverString {
    return this.version;
  }

  coveredPackages(): string[] {
    return [...this.packages];
  }

  hasPackage(packageName: string): boolean {
    return this.packages.has(packageName);
  }
}

// ─── Version resolution helpers ──────────────────────────────────

/**
 * Check if an API is available at the given installed version.
 * Uses the `availableIn` semver range from the spec.
 */
function isAvailable(spec: ApiSpec, version: SemverString): boolean {
  const coerced = semver.coerce(version);
  if (!coerced) return false;
  return semver.satisfies(coerced, spec.availableIn);
}

/**
 * Check if an API only exists in a future version (installed version is too old).
 * Returns true if the API's minimum version is higher than the installed version.
 */
function isFutureApi(spec: ApiSpec, version: SemverString): boolean {
  const coerced = semver.coerce(version);
  if (!coerced) return false;

  // Extract the minimum version from the availableIn range
  const minVersion = semver.minVersion(spec.availableIn);
  if (!minVersion) return false;

  return semver.lt(coerced, minVersion);
}

/**
 * Find the active signature for the installed version.
 * A signature is active if `since <= version` and either no `until` or `version < until`.
 */
function findActiveSignature(
  spec: ApiSpec,
  version: SemverString,
): SignatureSpec | undefined {
  const coerced = semver.coerce(version);
  if (!coerced) return undefined;

  // Find the most recent signature that applies to this version
  // (signatures should be ordered by `since`, but we search for the best match)
  let best: SignatureSpec | undefined;

  for (const sig of spec.signatures) {
    const sinceSemver = semver.coerce(sig.since);
    if (!sinceSemver) continue;

    // version must be >= since
    if (semver.lt(coerced, sinceSemver)) continue;

    // If until is set, version must be < until
    if (sig.until) {
      const untilSemver = semver.coerce(sig.until);
      if (untilSemver && semver.gte(coerced, untilSemver)) continue;
    }

    // Take the most recent applicable signature
    if (
      !best ||
      !semver.coerce(best.since) ||
      semver.gt(sinceSemver, semver.coerce(best.since)!)
    ) {
      best = sig;
    }
  }

  return best;
}

/**
 * Find the active deprecation for the installed version.
 * A deprecation is active if `since <= version` and either:
 * - No `removedIn` (still deprecated but available), or
 * - `version < removedIn` (deprecated but not yet removed)
 *
 * If `version >= removedIn`, the API is removed — the deprecation is still
 * returned as it contains the removal info.
 */
function findActiveDeprecation(
  spec: ApiSpec,
  version: SemverString,
): DeprecationEntry | undefined {
  const coerced = semver.coerce(version);
  if (!coerced) return undefined;

  for (const dep of spec.deprecations) {
    const sinceSemver = semver.coerce(dep.since);
    if (!sinceSemver) continue;

    // Deprecation must have been announced by this version
    if (semver.lt(coerced, sinceSemver)) continue;

    // This deprecation applies to the installed version
    return dep;
  }

  return undefined;
}

// ─── Loading ─────────────────────────────────────────────────────

/**
 * Default authority data directory (ships with the package).
 */
const DEFAULT_AUTHORITY_DIR = resolve(
  import.meta.dirname,
  "../../authority-data",
);

/**
 * Load the authority store from the built-in data directory.
 */
export async function loadBuiltinAuthority(): Promise<InMemoryAuthorityStore> {
  return loadAuthorityFromDir(DEFAULT_AUTHORITY_DIR);
}

/**
 * Load the authority store from a given directory.
 * Reads manifest.json, validates it, then loads each spec file.
 */
export async function loadAuthorityFromDir(
  dir: string,
): Promise<InMemoryAuthorityStore> {
  const manifestPath = join(dir, "manifest.json");
  const manifestRaw = await readFile(manifestPath, "utf-8");
  const manifest: AuthorityManifest = AuthorityManifestSchema.parse(
    JSON.parse(manifestRaw),
  );

  const specs = new Map<string, ApiSpec>();
  const packages = new Set<string>();
  const hashInput = createHash("sha256");

  // Feed manifest into hash
  hashInput.update(manifestRaw);

  for (const entry of manifest.packages) {
    const specPath = join(dir, entry.specFile);
    const specRaw = await readFile(specPath, "utf-8");
    hashInput.update(specRaw);

    const dataFile = AuthorityDataFileSchema.parse(JSON.parse(specRaw));
    packages.add(dataFile.package);

    for (const spec of dataFile.specs) {
      const key = `${spec.package}/${spec.export}`;
      specs.set(key, spec);
    }
  }

  return new InMemoryAuthorityStore(
    specs,
    packages,
    hashInput.digest("hex"),
    manifest.dataVersion,
  );
}

/**
 * Create an authority store from an array of specs (for testing).
 */
export function createAuthorityStoreFromSpecs(
  apiSpecs: ApiSpec[],
  version = "0.0.0-test",
): InMemoryAuthorityStore {
  const specs = new Map<string, ApiSpec>();
  const packages = new Set<string>();
  const hash = createHash("sha256");

  for (const spec of apiSpecs) {
    const key = `${spec.package}/${spec.export}`;
    specs.set(key, spec);
    packages.add(spec.package);
    hash.update(JSON.stringify(spec));
  }

  return new InMemoryAuthorityStore(specs, packages, hash.digest("hex"), version);
}
