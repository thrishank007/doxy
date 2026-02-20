/**
 * SWC parser bridge — parse TS/TSX/JS/JSX into NormalizedAST.
 *
 * Uses @swc/core parseSync to produce an ECMAScript AST,
 * then walks it to extract imports, call expressions, and JSX elements.
 */
import { parseSync, type Module, type ModuleItem, type Statement, type Expression } from "@swc/core";
import type {
  NormalizedAST,
  NormalizedImport,
  NormalizedCallExpression,
  NormalizedJSXElement,
  ImportSpecifier,
  LanguageParser,
  SourceLocation,
} from "../core/types/index.js";

/**
 * Determine SWC syntax options from file extension.
 */
function syntaxFor(filePath: string): { syntax: "typescript" | "ecmascript"; tsx?: boolean; jsx?: boolean } {
  if (filePath.endsWith(".tsx")) return { syntax: "typescript", tsx: true };
  if (filePath.endsWith(".ts")) return { syntax: "typescript", tsx: false };
  if (filePath.endsWith(".jsx")) return { syntax: "ecmascript", jsx: true };
  return { syntax: "ecmascript", jsx: false };
}

/**
 * Convert SWC span to SourceLocation.
 * SWC provides line/column as 1-based line, 0-based column.
 */
function toLocation(span: { start: number; end: number }, file: string, lines: number[]): SourceLocation {
  const startLine = findLine(lines, span.start);
  const startCol = span.start - (lines[startLine - 1] ?? 0);
  const endLine = findLine(lines, span.end);
  const endCol = span.end - (lines[endLine - 1] ?? 0);
  return { file, line: startLine, column: startCol, endLine, endColumn: endCol };
}

/**
 * Build a line offset table from source text.
 * lines[i] = byte offset of the start of line i+1.
 */
function buildLineOffsets(source: string): number[] {
  const offsets: number[] = [0]; // line 1 starts at offset 0
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

/**
 * Find the 1-based line number for a given byte offset.
 */
function findLine(offsets: number[], offset: number): number {
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((offsets[mid] ?? 0) <= offset) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo + 1; // 1-based
}

/**
 * SWC-based LanguageParser implementation.
 */
export class SwcParser implements LanguageParser {
  extensions = [".ts", ".tsx", ".js", ".jsx"];

  parse(source: string, filePath: string): NormalizedAST {
    const { syntax, tsx, jsx } = syntaxFor(filePath);

    const module: Module = parseSync(source, {
      syntax,
      ...(syntax === "typescript" ? { tsx } : { jsx }),
      comments: false,
      target: "es2022",
    });

    const lines = buildLineOffsets(source);
    const imports: NormalizedImport[] = [];
    const callExpressions: NormalizedCallExpression[] = [];
    const jsxElements: NormalizedJSXElement[] = [];

    for (const item of module.body) {
      extractFromModuleItem(item, filePath, lines, imports, callExpressions, jsxElements);
    }

    return { imports, callExpressions, jsxElements };
  }
}

// ─── AST extraction ──────────────────────────────────────────────

function extractFromModuleItem(
  item: ModuleItem,
  file: string,
  lines: number[],
  imports: NormalizedImport[],
  calls: NormalizedCallExpression[],
  jsxElements: NormalizedJSXElement[],
): void {
  switch (item.type) {
    case "ImportDeclaration":
      imports.push(extractImportDeclaration(item, file, lines));
      break;
    case "ExportDeclaration":
      if (item.declaration) {
        extractFromStatement(item.declaration, file, lines, calls, jsxElements);
      }
      break;
    case "ExportDefaultDeclaration":
      if (item.decl && "type" in item.decl) {
        extractFromExpression(item.decl as Expression, file, lines, calls, jsxElements);
      }
      break;
    case "ExportDefaultExpression":
      extractFromExpression(item.expression, file, lines, calls, jsxElements);
      break;
    default:
      if ("type" in item) {
        extractFromStatement(item as Statement, file, lines, calls, jsxElements);
      }
  }
}

function extractImportDeclaration(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any,
  file: string,
  lines: number[],
): NormalizedImport {
  const specifiers: ImportSpecifier[] = [];
  let hasDefault = false;
  let defaultLocal: string | undefined;
  let hasNamespace = false;
  let namespaceLocal: string | undefined;
  const isTypeOnly = node.typeOnly ?? false;

  for (const spec of node.specifiers ?? []) {
    if (spec.type === "ImportDefaultSpecifier") {
      hasDefault = true;
      defaultLocal = spec.local.value;
    } else if (spec.type === "ImportNamespaceSpecifier") {
      hasNamespace = true;
      namespaceLocal = spec.local.value;
    } else if (spec.type === "ImportSpecifier") {
      const imported = spec.imported?.value ?? spec.local.value;
      specifiers.push({
        imported,
        local: spec.local.value,
        isTypeOnly: spec.isTypeOnly ?? false,
      });
    }
  }

  return {
    source: node.source.value,
    specifiers,
    hasDefault,
    defaultLocal,
    hasNamespace,
    namespaceLocal,
    isTypeOnly,
    isRequire: false,
    location: toLocation(node.span, file, lines),
  };
}

function extractFromStatement(
  stmt: Statement,
  file: string,
  lines: number[],
  calls: NormalizedCallExpression[],
  jsxElements: NormalizedJSXElement[],
): void {
  switch (stmt.type) {
    case "ExpressionStatement":
      extractFromExpression(stmt.expression, file, lines, calls, jsxElements);
      break;
    case "VariableDeclaration":
      for (const decl of stmt.declarations) {
        if (decl.init) {
          // Check for require() patterns
          if (decl.init.type === "CallExpression" && isRequireCall(decl.init)) {
            extractRequire(decl, file, lines, calls);
          } else {
            extractFromExpression(decl.init, file, lines, calls, jsxElements);
          }
        }
      }
      break;
    case "ReturnStatement":
      if (stmt.argument) extractFromExpression(stmt.argument, file, lines, calls, jsxElements);
      break;
    case "IfStatement":
      extractFromExpression(stmt.test, file, lines, calls, jsxElements);
      extractFromStatement(stmt.consequent, file, lines, calls, jsxElements);
      if (stmt.alternate) extractFromStatement(stmt.alternate, file, lines, calls, jsxElements);
      break;
    case "BlockStatement":
      for (const s of stmt.stmts) extractFromStatement(s, file, lines, calls, jsxElements);
      break;
    case "FunctionDeclaration":
      if (stmt.body) extractFromStatement(stmt.body, file, lines, calls, jsxElements);
      break;
    case "ClassDeclaration":
      for (const member of stmt.body) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const m = member as any;
        if (m.value?.body) {
          extractFromStatement(m.value.body, file, lines, calls, jsxElements);
        }
      }
      break;
    default:
      break;
  }
}

function extractFromExpression(
  expr: Expression,
  file: string,
  lines: number[],
  calls: NormalizedCallExpression[],
  jsxElements: NormalizedJSXElement[],
): void {
  if (!expr) return;

  switch (expr.type) {
    case "CallExpression": {
      const callee = calleeToString(expr.callee);
      if (callee) {
        calls.push({
          callee,
          argCount: expr.arguments.length,
          argNames: extractArgNames(expr.arguments),
          location: toLocation(expr.span, file, lines),
        });
      }
      // Recurse into arguments
      for (const arg of expr.arguments) {
        extractFromExpression(arg.expression, file, lines, calls, jsxElements);
      }
      break;
    }
    case "ArrowFunctionExpression":
      if (expr.body.type === "BlockStatement") {
        extractFromStatement(expr.body, file, lines, calls, jsxElements);
      } else {
        extractFromExpression(expr.body, file, lines, calls, jsxElements);
      }
      break;
    case "FunctionExpression":
      if (expr.body) extractFromStatement(expr.body, file, lines, calls, jsxElements);
      break;
    case "ParenthesisExpression":
      extractFromExpression(expr.expression, file, lines, calls, jsxElements);
      break;
    case "ConditionalExpression":
      extractFromExpression(expr.test, file, lines, calls, jsxElements);
      extractFromExpression(expr.consequent, file, lines, calls, jsxElements);
      extractFromExpression(expr.alternate, file, lines, calls, jsxElements);
      break;
    case "SequenceExpression":
      for (const e of expr.expressions) extractFromExpression(e, file, lines, calls, jsxElements);
      break;
    case "AssignmentExpression":
      extractFromExpression(expr.right, file, lines, calls, jsxElements);
      break;
    case "MemberExpression":
      // Not a call by itself, just traversing
      break;
    case "JSXElement":
      jsxElements.push(extractJSXElement(expr, file, lines));
      // Recurse into children
      for (const child of expr.children) {
        if (child.type === "JSXExpressionContainer" && child.expression.type !== "JSXEmptyExpression") {
          extractFromExpression(child.expression, file, lines, calls, jsxElements);
        } else if (child.type === "JSXElement") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          extractFromExpression(child as any, file, lines, calls, jsxElements);
        }
      }
      break;
    case "JSXFragment":
      for (const child of expr.children) {
        if (child.type === "JSXExpressionContainer" && child.expression.type !== "JSXEmptyExpression") {
          extractFromExpression(child.expression, file, lines, calls, jsxElements);
        } else if (child.type === "JSXElement") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          extractFromExpression(child as any, file, lines, calls, jsxElements);
        }
      }
      break;
    case "TaggedTemplateExpression":
      extractFromExpression(expr.tag, file, lines, calls, jsxElements);
      break;
    case "TemplateLiteral":
      for (const e of expr.expressions) extractFromExpression(e, file, lines, calls, jsxElements);
      break;
    case "ArrayExpression":
      for (const el of expr.elements) {
        if (el?.expression) extractFromExpression(el.expression, file, lines, calls, jsxElements);
      }
      break;
    case "ObjectExpression":
      for (const prop of expr.properties) {
        if (prop.type === "KeyValueProperty") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          extractFromExpression((prop as any).value, file, lines, calls, jsxElements);
        } else if (prop.type === "SpreadElement") {
          extractFromExpression(prop.arguments, file, lines, calls, jsxElements);
        }
      }
      break;
    default:
      break;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calleeToString(callee: any): string | undefined {
  if (!callee) return undefined;
  if (callee.type === "Identifier") return callee.value;
  if (callee.type === "MemberExpression") {
    const obj = calleeToString(callee.object);
    const prop =
      callee.property.type === "Identifier"
        ? callee.property.value
        : callee.property.type === "Computed"
          ? undefined
          : undefined;
    if (obj && prop) return `${obj}.${prop}`;
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isRequireCall(expr: any): boolean {
  return (
    expr.type === "CallExpression" &&
    expr.callee?.type === "Identifier" &&
    expr.callee.value === "require"
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractRequire(decl: any, _file: string, _lines: number[], _calls: NormalizedCallExpression[]): void {
  // require() calls are tracked as imports, not call expressions
  // The import resolver handles require patterns separately
  // We just note them here for potential future use
  void decl;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractArgNames(args: any[]): string[] {
  const names: string[] = [];
  for (const arg of args) {
    if (arg.expression?.type === "ObjectExpression") {
      for (const prop of arg.expression.properties) {
        if (prop.type === "KeyValueProperty" || prop.type === "Identifier") {
          const key = prop.key ?? prop;
          if (key.type === "Identifier") names.push(key.value);
        }
      }
    }
  }
  return names;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJSXElement(expr: any, file: string, lines: number[]): NormalizedJSXElement {
  const opening = expr.opening;
  let tagName = "unknown";
  if (opening?.name) {
    tagName = jsxNameToString(opening.name);
  }

  const attributes: string[] = [];
  for (const attr of opening?.attributes ?? []) {
    if (attr.type === "JSXAttribute" && attr.name) {
      if (attr.name.type === "Identifier") attributes.push(attr.name.value);
      else if (attr.name.type === "JSXNamespacedName") {
        attributes.push(`${attr.name.namespace.value}:${attr.name.name.value}`);
      }
    }
  }

  return {
    tagName,
    attributes,
    location: toLocation(expr.span, file, lines),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jsxNameToString(name: any): string {
  if (name.type === "Identifier") return name.value;
  if (name.type === "JSXMemberExpression") {
    const obj = jsxNameToString(name.object);
    return `${obj}.${name.property.value}`;
  }
  if (name.type === "JSXNamespacedName") {
    return `${name.namespace.value}:${name.name.value}`;
  }
  return "unknown";
}
