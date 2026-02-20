/**
 * React Framework Adapter — handles React-specific import patterns.
 *
 * Key behaviors:
 * - React default import treated as namespace (import React; React.useState())
 * - react-dom subpath mapping (react-dom/client → react-dom)
 * - ReactDOM default-as-namespace pattern
 */
import type {
  FrameworkAdapter,
  SymbolUsage,
  NormalizedImport,
  NormalizedAST,
  RepoContext,
  DetectedFramework,
  Finding,
} from "../core/types/index.js";
import { resolveImports } from "../core/import-resolver/index.js";

/** Packages the React adapter handles */
const REACT_PACKAGES = new Set(["react", "react-dom"]);

/**
 * react-dom subpath → canonical package mapping.
 * Imports from "react-dom/client", "react-dom/server" etc.
 * all resolve to the "react-dom" package for authority lookups.
 */
const REACT_DOM_SUBPATHS = new Set([
  "react-dom/client",
  "react-dom/server",
  "react-dom/test-utils",
]);

export class ReactAdapter implements FrameworkAdapter {
  id = "react";
  displayName = "React";
  packages = ["react", "react-dom"];

  detect(repoCtx: RepoContext): DetectedFramework | undefined {
    return repoCtx.frameworks.find((f) => f.id === "react");
  }

  resolveSymbols(imports: NormalizedImport[], ast: NormalizedAST): SymbolUsage[] {
    // Pre-process imports: normalize react-dom subpaths
    const normalizedImports = imports.map((imp) => normalizeReactImport(imp));

    // Use the generic import resolver with React packages as tracked
    const { usages } = resolveImports(
      { ...ast, imports: normalizedImports },
      REACT_PACKAGES,
    );

    return usages;
  }

  enrichFindings(findings: Finding[]): Finding[] {
    // No React-specific enrichment for now
    return findings;
  }
}

/**
 * Normalize a React-related import.
 * - Maps react-dom subpaths to "react-dom"
 * - Preserves all other imports as-is
 */
function normalizeReactImport(imp: NormalizedImport): NormalizedImport {
  if (REACT_DOM_SUBPATHS.has(imp.source)) {
    return { ...imp, source: "react-dom" };
  }
  return imp;
}
