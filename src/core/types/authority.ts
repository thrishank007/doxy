/**
 * Authority data types — API spec definitions and the store interface.
 */
import type {
  ContentHash,
  SemverRange,
  SemverString,
} from "./common.js";

/** What kind of export an API symbol is */
export type ApiKind =
  | "function"
  | "component"
  | "type"
  | "constant"
  | "class"
  | "hook";

/** A single parameter in an API signature */
export interface ParameterSpec {
  name: string;
  required: boolean;
  /** Brief description of the parameter's purpose */
  description?: string;
}

/** A versioned signature for an API */
export interface SignatureSpec {
  /** Version range this signature applies to */
  since: SemverString;
  /** Version this signature was replaced (exclusive upper bound) */
  until?: SemverString;
  /** Minimum number of arguments */
  minArity: number;
  /** Maximum number of arguments (Infinity for rest params) */
  maxArity: number;
  /** Parameter details */
  params: ParameterSpec[];
}

/** Points to a replacement API for a deprecated/removed one */
export interface ReplacementRef {
  /** Package containing the replacement */
  package: string;
  /** Export name of the replacement */
  export: string;
  /** Human-readable migration hint */
  migrationHint: string;
}

/** A single deprecation/removal event in an API's timeline */
export interface DeprecationEntry {
  /** Version when the deprecation was announced */
  since: SemverString;
  /** Version when the API was removed (undefined = still deprecated but available) */
  removedIn?: SemverString;
  /** Human-readable deprecation message */
  message: string;
  /** Suggested replacement */
  replacement?: ReplacementRef;
}

/** Full specification of one exported API symbol */
export interface ApiSpec {
  /** Package name (e.g., "react", "react-dom") */
  package: string;
  /** Export name (e.g., "useState", "createRoot") */
  export: string;
  /** What kind of thing this is */
  kind: ApiKind;
  /** Version range where this API exists at all */
  availableIn: SemverRange;
  /** Signatures across versions */
  signatures: SignatureSpec[];
  /** Deprecation/removal history (ordered by `since`) */
  deprecations: DeprecationEntry[];
  /** URL to official documentation */
  docsUrl?: string;
}

/** Result of querying the authority store for a specific version */
export interface ResolvedApiSpec {
  /** The raw specification */
  spec: ApiSpec;
  /** The active signature for the queried version (undefined if no matching signature) */
  activeSignature?: SignatureSpec;
  /** The active deprecation entry for the queried version (undefined if not deprecated) */
  activeDeprecation?: DeprecationEntry;
  /** Whether the API is available at the queried version */
  available: boolean;
  /** Whether the API only exists in a future version (not yet available) */
  isFuture: boolean;
}

/** Index of all authority data packages */
export interface AuthorityManifest {
  /** Schema version for the authority data format (bump on breaking changes) */
  schemaVersion: number;
  /** Semver of the dataset itself (bump when entries added/updated) */
  dataVersion: SemverString;
  /** Index of packages covered */
  packages: AuthorityPackageEntry[];
}

/** One package entry in the authority manifest */
export interface AuthorityPackageEntry {
  /** Package name */
  name: string;
  /** Latest version mapped in the authority data */
  latestMappedVersion: SemverString;
  /** Relative path to the spec data file */
  specFile: string;
}

/** The queryable authority store interface */
export interface AuthorityStore {
  /**
   * Look up an API spec for a specific package, export, and installed version.
   * Returns undefined if the package/export is not in the authority data.
   */
  getApiSpec(
    packageName: string,
    exportName: string,
    installedVersion: SemverString,
  ): ResolvedApiSpec | undefined;

  /** SHA-256 hash of all loaded authority data, for cache invalidation */
  contentHash(): ContentHash;

  /** The data version of the loaded authority dataset */
  dataVersion(): SemverString;

  /** List all packages covered by the authority data */
  coveredPackages(): string[];

  /** Check if a package is covered */
  hasPackage(packageName: string): boolean;
}
