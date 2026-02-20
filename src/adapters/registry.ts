/**
 * Adapter Registry — auto-detect and load framework adapters.
 */
import type { FrameworkAdapter, RepoContext } from "../core/types/index.js";
import { ReactAdapter } from "./react.js";

/** All available adapters */
const ALL_ADAPTERS: FrameworkAdapter[] = [
  new ReactAdapter(),
];

/**
 * Detect which adapters are active for the given repo context.
 * Returns adapters in priority order (more specific first).
 */
export function detectAdapters(repoCtx: RepoContext): FrameworkAdapter[] {
  return ALL_ADAPTERS.filter((adapter) => adapter.detect(repoCtx) !== undefined);
}

/**
 * Get an adapter by its ID.
 */
export function getAdapter(id: string): FrameworkAdapter | undefined {
  return ALL_ADAPTERS.find((a) => a.id === id);
}
