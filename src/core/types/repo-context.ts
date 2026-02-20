/**
 * Repo context types — everything doxy needs to know about the project.
 */
import type {
  AbsolutePath,
  ContentHash,
  DetectionConfidence,
  PackageManager,
  SemverRange,
  SemverString,
} from "./common.js";

/** Version information for a single dependency */
export interface DependencyInfo {
  /** Exact resolved version from lockfile (e.g., "18.2.0") */
  resolvedVersion?: SemverString;
  /** Declared version range from package.json (e.g., "^18.0.0") */
  declaredRange: SemverRange;
}

/** A detected framework with version info */
export interface DetectedFramework {
  /** Framework identifier (e.g., "react", "nextjs") */
  id: string;
  /** Display name */
  name: string;
  /** Resolved version */
  version: SemverString;
  /** How the version was determined */
  confidence: DetectionConfidence;
}

/** Relevant tsconfig compiler options */
export interface TsconfigInfo {
  /** Path aliases (e.g., { "@/*": ["./src/*"] }) */
  paths?: Record<string, string[]>;
  /** Base URL for non-relative module names */
  baseUrl?: string;
  /** JSX setting (e.g., "react-jsx", "react") */
  jsx?: string;
}

/** Complete project context */
export interface RepoContext {
  /** Absolute path to the project root */
  root: AbsolutePath;
  /** Detected package manager */
  packageManager: PackageManager;
  /** All dependencies with exact resolved versions */
  dependencies: Record<string, DependencyInfo>;
  /** Detected frameworks */
  frameworks: DetectedFramework[];
  /** Relevant tsconfig options */
  tsconfig: TsconfigInfo;
  /** SHA-256 hash of all inputs (for cache keying) */
  contextHash: ContentHash;
}
