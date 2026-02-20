/**
 * Pipeline types — the five-step orchestration contract.
 */
import type { AbsolutePath } from "./common.js";
import type { DoxyConfig } from "./config.js";
import type { AuthorityStore } from "./authority.js";
import type { RepoContext } from "./repo-context.js";
import type { CacheStore } from "./cache.js";
import type { RunPlan } from "./run-plan.js";
import type { Finding } from "./finding.js";
import type { FrameworkAdapter } from "./adapter.js";

/** Options for building a run plan */
export interface PlanOptions {
  /** Only analyze changed files */
  changedOnly: boolean;
  /** Base git ref for diff (implies changedOnly) */
  baseRef?: string;
  /** Disable cache entirely */
  noCache: boolean;
}

/** The five pipeline steps as a typed contract */
export interface Pipeline {
  /** Step 1: Read the filesystem, produce project context */
  loadRepoContext(
    root: AbsolutePath,
    overrides?: Partial<RepoContext>,
  ): Promise<RepoContext>;

  /** Step 2: Load and index authority data */
  buildAuthority(storePath: AbsolutePath): Promise<AuthorityStore>;

  /** Step 3: Decide what work to do */
  planRun(
    root: AbsolutePath,
    repoCtx: RepoContext,
    authority: AuthorityStore,
    cache: CacheStore | undefined,
    options: PlanOptions,
  ): Promise<RunPlan>;

  /** Step 4: Analyze files (parallelizable) */
  analyzeFiles(
    plan: RunPlan,
    repoCtx: RepoContext,
    authority: AuthorityStore,
    adapters: FrameworkAdapter[],
    config: DoxyConfig,
  ): Promise<Finding[]>;

  /** Step 5: Combine fresh findings with cached findings */
  mergeWithCache(
    freshFindings: Finding[],
    cache: CacheStore | undefined,
    plan: RunPlan,
  ): Finding[];
}
