/**
 * Normalized AST types — minimal, language-agnostic structure
 * produced by language parsers and consumed by the analyzer.
 */
import type { SourceLocation } from "./common.js";

/** A normalized import declaration */
export interface NormalizedImport {
  /** The import source string (e.g., "react", "./utils", "next/link") */
  source: string;
  /** Named import specifiers (e.g., [{ imported: "useState", local: "useState" }]) */
  specifiers: ImportSpecifier[];
  /** Whether this is a default import */
  hasDefault: boolean;
  /** Local name of the default import (e.g., "React") */
  defaultLocal?: string;
  /** Whether this is a namespace import (import * as X) */
  hasNamespace: boolean;
  /** Local name of the namespace binding (e.g., "React") */
  namespaceLocal?: string;
  /** Whether this is a type-only import */
  isTypeOnly: boolean;
  /** Whether this is a require() call */
  isRequire: boolean;
  /** Location of the import statement */
  location: SourceLocation;
}

/** A single import specifier in a named import */
export interface ImportSpecifier {
  /** The name as exported by the source module */
  imported: string;
  /** The local binding name (same as imported if no alias) */
  local: string;
  /** Whether this specific specifier is type-only */
  isTypeOnly: boolean;
}

/** A normalized call expression */
export interface NormalizedCallExpression {
  /**
   * The callee as a string.
   * - Direct: "useState"
   * - Member: "React.useState"
   * - Chained: "React.createElement"
   */
  callee: string;
  /** Number of arguments */
  argCount: number;
  /** Argument names where detectable (e.g., from object literal keys) */
  argNames: string[];
  /** Location of the call */
  location: SourceLocation;
}

/** A normalized JSX element */
export interface NormalizedJSXElement {
  /** Tag name (e.g., "div", "MyComponent", "React.Fragment") */
  tagName: string;
  /** Attribute names */
  attributes: string[];
  /** Location of the opening tag */
  location: SourceLocation;
}

/** The complete normalized AST for a single file */
export interface NormalizedAST {
  /** All import declarations (including require calls) */
  imports: NormalizedImport[];
  /** All call expressions */
  callExpressions: NormalizedCallExpression[];
  /** All JSX elements */
  jsxElements: NormalizedJSXElement[];
}

/** Language parser contract */
export interface LanguageParser {
  /** File extensions this parser handles (e.g., [".ts", ".tsx", ".js", ".jsx"]) */
  extensions: string[];

  /** Parse a file's source text into a normalized AST */
  parse(source: string, filePath: string): NormalizedAST;
}
