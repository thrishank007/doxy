/**
 * Import Resolver — maps NormalizedImport[] + NormalizedAST to SymbolUsage[].
 *
 * Handles:
 * 1. Named imports: import { useState } from "react"
 * 2. Namespace imports: import * as React from "react"; React.useState()
 * 3. Default imports with member access: import React from "react"; React.createElement()
 * 4. require(): const { useState } = require("react")
 * 5. Aliased imports: import { useState as useMyState } from "react"
 * 6. Subpath imports: import { createRoot } from "react-dom/client"
 * 7. Scoped packages: import { thing } from "@tanstack/react-query"
 */
import type {
  NormalizedAST,
  SymbolUsage,
  ImportKind,
  SourceLocation,
} from "../types/index.js";

/** Binding info tracked during resolution */
interface Binding {
  /** The package this binding came from */
  package: string;
  /** The original export name */
  exportName: string;
  /** How it was imported */
  importKind: ImportKind;
  /** Location of the import statement */
  importLocation: SourceLocation;
}

/**
 * Resolve imports and call expressions into SymbolUsage objects.
 *
 * @param ast The normalized AST from the parser
 * @param trackedPackages Only resolve symbols from these packages (authority-tracked).
 *   If undefined, resolves all non-relative imports.
 */
export function resolveImports(
  ast: NormalizedAST,
  trackedPackages?: Set<string>,
): { usages: SymbolUsage[]; importedPackages: string[]; unresolvedImports: string[] } {
  // Step 1: Build binding map from imports
  const bindings = new Map<string, Binding>(); // localName → Binding
  const namespacesAndDefaults = new Map<string, string>(); // localName → package
  const importedPackages = new Set<string>();
  const unresolvedImports: string[] = [];

  for (const imp of ast.imports) {
    if (imp.isTypeOnly) continue; // Skip type-only imports

    const pkg = extractPackageName(imp.source);
    if (!pkg) {
      // Relative or unresolvable import
      continue;
    }

    if (trackedPackages && !trackedPackages.has(pkg)) {
      unresolvedImports.push(imp.source);
      continue;
    }

    importedPackages.add(pkg);

    // Named imports: import { useState, useEffect as myEffect } from "react"
    for (const spec of imp.specifiers) {
      if (spec.isTypeOnly) continue;
      bindings.set(spec.local, {
        package: pkg,
        exportName: spec.imported,
        importKind: "named",
        importLocation: imp.location,
      });
    }

    // Default import: import React from "react"
    if (imp.hasDefault && imp.defaultLocal) {
      namespacesAndDefaults.set(imp.defaultLocal, pkg);
      bindings.set(imp.defaultLocal, {
        package: pkg,
        exportName: "default",
        importKind: "default",
        importLocation: imp.location,
      });
    }

    // Namespace import: import * as React from "react"
    if (imp.hasNamespace && imp.namespaceLocal) {
      namespacesAndDefaults.set(imp.namespaceLocal, pkg);
      bindings.set(imp.namespaceLocal, {
        package: pkg,
        exportName: "*",
        importKind: "namespace",
        importLocation: imp.location,
      });
    }
  }

  // Step 2: Resolve call expressions against bindings
  const usageMap = new Map<string, SymbolUsage>(); // "package/export" → SymbolUsage

  for (const call of ast.callExpressions) {
    const resolved = resolveCallee(call.callee, bindings, namespacesAndDefaults);
    if (!resolved) continue;

    const key = `${resolved.package}/${resolved.exportName}`;
    let usage = usageMap.get(key);
    if (!usage) {
      usage = {
        package: resolved.package,
        export: resolved.exportName,
        importKind: resolved.importKind,
        usageSites: [],
      };
      usageMap.set(key, usage);
    }

    usage.usageSites.push({
      location: call.location,
      argCount: call.argCount,
      argNames: call.argNames.length > 0 ? call.argNames : undefined,
    });
  }

  // Step 3: Add import-only usages (symbols imported but not necessarily called)
  // This catches deprecated imports even without call sites
  for (const [, binding] of bindings) {
    if (binding.exportName === "default" || binding.exportName === "*") continue;
    const key = `${binding.package}/${binding.exportName}`;
    if (!usageMap.has(key)) {
      usageMap.set(key, {
        package: binding.package,
        export: binding.exportName,
        importKind: binding.importKind,
        usageSites: [{
          location: binding.importLocation,
        }],
      });
    }
  }

  return {
    usages: [...usageMap.values()],
    importedPackages: [...importedPackages],
    unresolvedImports,
  };
}

/**
 * Resolve a callee string to a package/export pair.
 *
 * - "useState" → look up in bindings
 * - "React.useState" → look up "React" in namespacesAndDefaults, export is "useState"
 */
function resolveCallee(
  callee: string,
  bindings: Map<string, Binding>,
  namespacesAndDefaults: Map<string, string>,
): { package: string; exportName: string; importKind: ImportKind } | undefined {
  // Direct binding match: "useState", "useMyState", etc.
  const directBinding = bindings.get(callee);
  if (directBinding && directBinding.exportName !== "default" && directBinding.exportName !== "*") {
    return {
      package: directBinding.package,
      exportName: directBinding.exportName,
      importKind: directBinding.importKind,
    };
  }

  // Member expression: "React.useState"
  const dotIdx = callee.indexOf(".");
  if (dotIdx !== -1) {
    const obj = callee.slice(0, dotIdx);
    const prop = callee.slice(dotIdx + 1);

    const pkg = namespacesAndDefaults.get(obj);
    if (pkg) {
      const binding = bindings.get(obj);
      return {
        package: pkg,
        exportName: prop,
        importKind: binding?.importKind === "namespace" ? "namespace" : "default",
      };
    }
  }

  return undefined;
}

/**
 * Extract the package name from an import source.
 *
 * "react" → "react"
 * "react-dom/client" → "react-dom"
 * "@tanstack/react-query" → "@tanstack/react-query"
 * "@tanstack/react-query/build" → "@tanstack/react-query"
 * "./utils" → undefined (relative)
 * "../foo" → undefined (relative)
 */
export function extractPackageName(source: string): string | undefined {
  // Relative imports
  if (source.startsWith(".") || source.startsWith("/")) return undefined;

  // Scoped packages: @scope/name or @scope/name/subpath
  if (source.startsWith("@")) {
    const parts = source.split("/");
    if (parts.length < 2) return undefined;
    return `${parts[0]}/${parts[1]}`;
  }

  // Unscoped: name or name/subpath
  const slashIdx = source.indexOf("/");
  return slashIdx === -1 ? source : source.slice(0, slashIdx);
}
