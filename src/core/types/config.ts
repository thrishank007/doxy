/**
 * Configuration types — doxy.config.json schema.
 */
import type { Severity } from "./finding.js";
import type { SuppressionRule } from "./suppression.js";

/** The full doxy configuration */
export interface DoxyConfig {
  /** Glob patterns for files to include */
  include: string[];
  /** Glob patterns for files to exclude */
  exclude: string[];
  /** Minimum severity to report (default: "warning") */
  severity: Severity;
  /** Exit non-zero if findings at this severity or above (default: "error") */
  failOn: Severity;
  /** Framework version overrides (e.g., { "react": "18.2.0" }) */
  frameworks: Record<string, string>;
  /** Manual path aliases for bundler aliases not in tsconfig */
  pathAliases: Record<string, string>;
  /** Config-level suppression rules */
  suppressions: SuppressionRule[];
  /** When true, inline doxy-ignore comments must include a reason */
  requireSuppressionReason: boolean;
  /** Authority data sources (default: ["builtin"]) */
  authorityDataSources: string[];
}

/** Default configuration values */
export const DEFAULT_CONFIG: DoxyConfig = {
  include: ["src/**/*.{ts,tsx,js,jsx}"],
  exclude: ["**/*.test.*", "**/*.spec.*", "**/node_modules/**"],
  severity: "warning",
  failOn: "error",
  frameworks: {},
  pathAliases: {},
  suppressions: [],
  requireSuppressionReason: false,
  authorityDataSources: ["builtin"],
};
