/**
 * Finding types — analysis results.
 */
import type { RelativePath, SemverString, SourceLocation } from "./common.js";

/** Classification of what's wrong */
export type ViolationKind =
  | "deprecated-api"
  | "removed-api"
  | "future-api"
  | "wrong-arity"
  | "wrong-param"
  | "unknown-export";

/** Severity level */
export type Severity = "error" | "warning" | "info";

/** Deterministic severity mapping (non-configurable at core level) */
export const SEVERITY_MAP: Record<ViolationKind, Severity> = {
  "removed-api": "error",
  "future-api": "error",
  "wrong-arity": "error",
  "wrong-param": "error",
  "deprecated-api": "warning",
  "unknown-export": "info",
} as const;

/** A text replacement suggestion */
export interface TextReplacement {
  /** Location of text to replace */
  location: SourceLocation;
  /** New text */
  newText: string;
}

/** A suggested fix for a finding */
export interface FixSuggestion {
  /** Human-readable description of the fix */
  description: string;
  /** Optional automatic text replacement */
  replacement?: TextReplacement;
  /** Optional reference URL (e.g., migration guide) */
  referenceUrl?: string;
}

/** Source and reason for a suppression */
export interface SuppressionInfo {
  source: "inline" | "config" | "baseline";
  reason: string;
}

/** A single analysis finding */
export interface Finding {
  /**
   * Short ID for display: `dxy_` + first 8 chars of SHA-256(longId)
   * Example: "dxy_a1b2c3d4"
   */
  id: string;

  /**
   * Canonical long ID: `dxy:<package>/<export>:<file>:<line>:<col>`
   * Example: "dxy:react/createFactory:src/App.tsx:14:5"
   */
  longId: string;

  /** What kind of violation */
  kind: ViolationKind;

  /** Severity (derived from kind via SEVERITY_MAP) */
  severity: Severity;

  /** Where in the source code */
  location: SourceLocation;

  /** Human-readable message */
  message: string;

  /** The symbol that triggered this finding */
  symbol: {
    package: string;
    export: string;
    installedVersion: SemverString;
  };

  /** Ordered fix suggestions (first = best) */
  fixes: FixSuggestion[];

  /** Reference to authority data source */
  authorityRef: {
    dataVersion: SemverString;
    specKey: string;
  };

  /** Present when the finding was suppressed */
  suppressed?: SuppressionInfo;
}

/** Process exit codes */
export const ExitCode = {
  CLEAN: 0,
  VIOLATIONS_FOUND: 1,
  CONFIG_ERROR: 2,
  PROJECT_ERROR: 3,
  AUTHORITY_ERROR: 4,
  INTERNAL_ERROR: 5,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

/**
 * Generate the canonical long ID for a finding.
 */
export function makeLongId(
  pkg: string,
  exportName: string,
  file: RelativePath,
  line: number,
  col: number,
): string {
  return `dxy:${pkg}/${exportName}:${file}:${line}:${col}`;
}

/**
 * Parse a long ID back into its components.
 * Returns undefined if the format is invalid.
 */
export function parseLongId(longId: string): {
  package: string;
  export: string;
  file: RelativePath;
  line: number;
  column: number;
} | undefined {
  // Format: dxy:<package>/<export>:<file>:<line>:<col>
  const match = longId.match(
    /^dxy:([^/]+)\/([^:]+):(.+):(\d+):(\d+)$/,
  );
  if (!match) return undefined;
  const [, pkg, exp, file, line, col] = match;
  if (!pkg || !exp || !file || !line || !col) return undefined;
  return {
    package: pkg,
    export: exp,
    file,
    line: parseInt(line, 10),
    column: parseInt(col, 10),
  };
}
