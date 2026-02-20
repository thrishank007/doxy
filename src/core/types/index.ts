/**
 * Central type exports for doxy.
 */

// Common primitives
export type {
  SemverString,
  SemverRange,
  ContentHash,
  AbsolutePath,
  RelativePath,
  Timestamp,
  SourceLocation,
  PackageManager,
  DetectionConfidence,
} from "./common.js";

// Authority data
export type {
  ApiKind,
  ParameterSpec,
  SignatureSpec,
  ReplacementRef,
  DeprecationEntry,
  ApiSpec,
  ResolvedApiSpec,
  AuthorityManifest,
  AuthorityPackageEntry,
  AuthorityStore,
} from "./authority.js";

// Repo context
export type {
  DependencyInfo,
  DetectedFramework,
  TsconfigInfo,
  RepoContext,
} from "./repo-context.js";

// Findings
export type {
  ViolationKind,
  Severity,
  TextReplacement,
  FixSuggestion,
  SuppressionInfo,
  Finding,
} from "./finding.js";
export { SEVERITY_MAP, ExitCode, makeLongId, parseLongId } from "./finding.js";

// Suppression
export type {
  SuppressionRule,
  InlineSuppression,
  Baseline,
} from "./suppression.js";

// Cache
export type { FileCacheEntry, CacheStore } from "./cache.js";

// Run plan
export type {
  AnalysisReason,
  FileToAnalyze,
  CachedFile,
  FileRename,
  RunPlan,
  RunPlanStats,
} from "./run-plan.js";

// Framework adapters
export type {
  ImportKind,
  UsageSite,
  SymbolUsage,
  FrameworkAdapter,
} from "./adapter.js";

// Normalized AST
export type {
  NormalizedImport,
  ImportSpecifier,
  NormalizedCallExpression,
  NormalizedJSXElement,
  NormalizedAST,
  LanguageParser,
} from "./normalized-ast.js";

// Config
export type { DoxyConfig } from "./config.js";
export { DEFAULT_CONFIG } from "./config.js";

// Pipeline
export type { PlanOptions, Pipeline } from "./pipeline.js";

// Zod schemas (runtime validation)
export {
  ApiSpecSchema,
  AuthorityDataFileSchema,
  AuthorityManifestSchema,
  DoxyConfigSchema,
  SuppressionRuleSchema,
  FindingSchema,
  FileCacheEntrySchema,
  CacheStoreSchema,
  BaselineSchema,
} from "./schemas.js";
