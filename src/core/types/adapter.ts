/**
 * Framework adapter types — the plugin contract for framework-specific logic.
 */
import type { SourceLocation } from "./common.js";
import type { Finding } from "./finding.js";
import type { RepoContext, DetectedFramework } from "./repo-context.js";
import type { NormalizedImport } from "./normalized-ast.js";
import type { NormalizedAST } from "./normalized-ast.js";

/** How a symbol was imported */
export type ImportKind = "named" | "default" | "namespace" | "dynamic";

/** A single usage site of a symbol */
export interface UsageSite {
  /** Where the usage occurs */
  location: SourceLocation;
  /** Number of arguments observed (for call expressions) */
  argCount?: number;
  /** Argument names observed (for object argument patterns, where detectable) */
  argNames?: string[];
}

/** A resolved symbol usage — the analyzer's primary input */
export interface SymbolUsage {
  /** Package name (e.g., "react") */
  package: string;
  /** Export name (e.g., "useState") */
  export: string;
  /** How it was imported */
  importKind: ImportKind;
  /** All sites where this symbol is used */
  usageSites: UsageSite[];
}

/** The framework adapter contract */
export interface FrameworkAdapter {
  /** Unique adapter identifier */
  id: string;
  /** Human-readable display name */
  displayName: string;
  /** Packages this adapter handles (e.g., ["react", "react-dom"]) */
  packages: string[];

  /**
   * Detect whether the framework is present in the project.
   * Returns undefined if not detected.
   */
  detect(repoCtx: RepoContext): DetectedFramework | undefined;

  /**
   * Resolve raw imports and AST nodes to structured SymbolUsage objects.
   * This is where framework-specific re-export mapping lives.
   */
  resolveSymbols(
    imports: NormalizedImport[],
    ast: NormalizedAST,
  ): SymbolUsage[];

  /**
   * Optional: enrich findings with framework-specific context.
   * Called after initial findings are emitted.
   */
  enrichFindings?(findings: Finding[]): Finding[];
}
