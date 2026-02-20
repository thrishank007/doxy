/**
 * Common primitive types used across the codebase.
 */

/** Semantic version string (e.g., "18.2.0") */
export type SemverString = string;

/** Semver range string (e.g., "^18.0.0", ">=16.3.0 <19.0.0") */
export type SemverRange = string;

/** SHA-256 hex digest */
export type ContentHash = string;

/** Absolute filesystem path */
export type AbsolutePath = string;

/** Relative filesystem path (from project root) */
export type RelativePath = string;

/** Unix timestamp in milliseconds */
export type Timestamp = number;

/** Source location within a file */
export interface SourceLocation {
  file: RelativePath;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

/** Package manager identifiers */
export type PackageManager = "npm" | "pnpm" | "yarn";

/** Confidence level for framework detection */
export type DetectionConfidence = "lockfile" | "manifest" | "inferred";
