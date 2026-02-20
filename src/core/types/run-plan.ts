/**
 * Run plan types — what the incremental engine decides to do.
 */
import type { RelativePath } from "./common.js";
import type { Finding } from "./finding.js";

/** Why a file needs (re-)analysis */
export type AnalysisReason =
  | "file-changed"
  | "file-new"
  | "file-renamed"
  | "manifest-changed"
  | "authority-updated"
  | "config-changed"
  | "cache-miss";

/** A file scheduled for analysis */
export interface FileToAnalyze {
  /** Relative path to the file */
  path: RelativePath;
  /** Why this file needs analysis */
  reason: AnalysisReason;
}

/** A file whose cached findings are still valid */
export interface CachedFile {
  /** Relative path to the file */
  path: RelativePath;
  /** Valid cached findings */
  findings: Finding[];
}

/** A detected file rename */
export interface FileRename {
  /** Original path */
  from: RelativePath;
  /** New path */
  to: RelativePath;
}

/** The analyzer's work order */
export interface RunPlan {
  /** Files that need fresh analysis */
  filesToAnalyze: FileToAnalyze[];
  /** Files with still-valid cached findings */
  cachedFiles: CachedFile[];
  /** Whether this is a full or incremental run */
  mode: "full" | "incremental";
  /** Base git ref for incremental (undefined for full) */
  baseRef?: string;
  /** Whether git is available in this environment */
  gitAvailable: boolean;
  /** Detected file renames for cache migration */
  renames: FileRename[];
  /** Aggregate stats */
  stats: RunPlanStats;
}

export interface RunPlanStats {
  /** Total source files in the project */
  totalFiles: number;
  /** Files scheduled for fresh analysis */
  changedFiles: number;
  /** Files served from cache */
  cachedFiles: number;
  /** Files whose cache was invalidated */
  invalidatedFiles: number;
}
