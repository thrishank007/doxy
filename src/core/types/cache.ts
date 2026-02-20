/**
 * Cache types — per-file result storage with smart invalidation.
 */
import type {
  ContentHash,
  RelativePath,
  SemverString,
  Timestamp,
} from "./common.js";
import type { Finding } from "./finding.js";

/** A single cached file entry */
export interface FileCacheEntry {
  /** Relative file path (cache key) */
  filePath: RelativePath;
  /** SHA-256 of the file's byte contents */
  contentHash: ContentHash;
  /** Authority data version used during analysis */
  authorityVersion: SemverString;
  /** Repo context hash used during analysis (global fallback) */
  repoContextHash: ContentHash;
  /** Authority-tracked packages this file imports (for smart invalidation) */
  importedPackages: string[];
  /** Exact resolved versions of imported packages at analysis time */
  packageVersions: Record<string, string>;
  /** Import specifiers that couldn't be resolved (for new-package detection) */
  unresolvedImports: string[];
  /** Findings from last analysis */
  findings: Finding[];
  /** When the analysis was performed */
  analyzedAt: Timestamp;
}

/** The full cache store */
export interface CacheStore {
  /** Cache entries keyed by relative file path */
  entries: Record<RelativePath, FileCacheEntry>;
  /** When the cache was created */
  createdAt: Timestamp;
  /** Doxy version that wrote the cache */
  doxyVersion: string;
}
