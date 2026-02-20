/**
 * Suppression types — mechanisms for silencing findings.
 */
import type { ViolationKind } from "./finding.js";

/** A config-level suppression rule */
export interface SuppressionRule {
  /** Scope to a specific package (optional) */
  package?: string;
  /** Scope to a specific export (optional) */
  export?: string;
  /** Violation kind to suppress, or "*" for all (default: "*") */
  kind: ViolationKind | "*";
  /** Glob patterns for file paths (optional — if omitted, applies to all files) */
  paths?: string[];
  /** Why this suppression exists (required) */
  reason: string;
}

/** An inline suppression comment extracted from source code */
export interface InlineSuppression {
  /** The violation kind being suppressed */
  kind: ViolationKind | "*";
  /** Optional reason from the comment */
  reason?: string;
  /** The line(s) this suppression covers */
  startLine: number;
  endLine: number;
}

/** Baseline file format — finding IDs from a baseline run */
export interface Baseline {
  /** Long IDs of all findings at baseline creation time */
  findingIds: string[];
  /** When the baseline was created */
  createdAt: number;
  /** Doxy version that created the baseline */
  doxyVersion: string;
}
