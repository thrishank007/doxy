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
  NormalizedReference,
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
function toLocation(
  span: { start: number; end: number },
  file: string,
  lines: LineInfo[],
): SourceLocation {
  const startLine = findLine(lines, span.start);
  const endLine = findLine(lines, span.end);
  const startCol = findColumn(lines[startLine - 1]!, span.start);
  const endCol = findColumn(lines[endLine - 1]!, span.end);
  return { file, line: startLine, column: startCol, endLine, endColumn: endCol };
}

/**
 * Build byte-aware line info from source text.
 */
interface LineInfo {
  startByte: number;
  rawText: string;
}

function buildLineOffsets(source: string, spanStart: number): LineInfo[] {
  const rawLines = source.split("\n");
  const lines: LineInfo[] = [];
  let startByte = spanStart;

  for (let i = 0; i < rawLines.length; i++) {
    const rawText = rawLines[i] ?? "";
    lines.push({ startByte, rawText });
    startByte += Buffer.byteLength(rawText);
    if (i < rawLines.length - 1) {
      startByte += 1; // newline byte
    }
  }

  return lines;
}

/**
 * Find the 1-based line number for a given SWC byte offset.
 */
function findLine(offsets: LineInfo[], offset: number): number {
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((offsets[mid]?.startByte ?? 1) <= offset) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo + 1; // 1-based
}

function findColumn(line: LineInfo, offset: number): number {
  let currentByte = line.startByte;
  let column = 1;

  for (const char of line.rawText) {
    if (currentByte >= offset) {
      break;
    }
    currentByte += Buffer.byteLength(char);
    column += 1;
  }

  return column;
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

    const lines = buildLineOffsets(source, module.span.start);
    const imports: NormalizedImport[] = [];
    const callExpressions: NormalizedCallExpression[] = [];
    const jsxElements: NormalizedJSXElement[] = [];
    const references: NormalizedReference[] = [];

    for (const item of module.body) {
      extractFromModuleItem(
        item,
        filePath,
        lines,
        imports,
        callExpressions,
        jsxElements,
        references,
      );
    }

    return { imports, callExpressions, jsxElements, references };
  }
}

// ─── AST extraction ──────────────────────────────────────────────

function extractFromModuleItem(
  item: ModuleItem,
  file: string,
  lines: LineInfo[],
  imports: NormalizedImport[],
  calls: NormalizedCallExpression[],
  jsxElements: NormalizedJSXElement[],
  references: NormalizedReference[],
): void {
  switch (item.type) {
    case "ImportDeclaration":
      imports.push(extractImportDeclaration(item, file, lines));
      break;
    case "ExportDeclaration":
      if (item.declaration) {
        extractFromStatement(
          item.declaration,
          file,
          lines,
          calls,
          jsxElements,
          references,
        );
      }
      break;
    case "ExportDefaultDeclaration":
      if (item.decl && "type" in item.decl) {
        extractFromExpression(
          item.decl as Expression,
          file,
          lines,
          calls,
          jsxElements,
          references,
        );
      }
      break;
    case "ExportDefaultExpression":
      extractFromExpression(
        item.expression,
        file,
        lines,
        calls,
        jsxElements,
        references,
      );
      break;
    default:
      if ("type" in item) {
        extractFromStatement(
          item as Statement,
          file,
          lines,
          calls,
          jsxElements,
          references,
        );
      }
  }
}

function extractImportDeclaration(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any,
  file: string,
  lines: LineInfo[],
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
  lines: LineInfo[],
  calls: NormalizedCallExpression[],
  jsxElements: NormalizedJSXElement[],
  references: NormalizedReference[],
): void {
  switch (stmt.type) {
    case "ExpressionStatement":
      extractFromExpression(
        stmt.expression,
        file,
        lines,
        calls,
        jsxElements,
        references,
      );
      break;
    case "VariableDeclaration":
      for (const decl of stmt.declarations) {
        if (decl.init) {
          // Check for require() patterns
          if (decl.init.type === "CallExpression" && isRequireCall(decl.init)) {
            extractRequire(decl, file, lines, calls);
          } else {
            extractFromExpression(
              decl.init,
              file,
              lines,
              calls,
              jsxElements,
              references,
            );
          }
        }
      }
      break;
    case "ReturnStatement":
      if (stmt.argument) {
        extractFromExpression(
          stmt.argument,
          file,
          lines,
          calls,
          jsxElements,
          references,
        );
      }
      break;
    case "IfStatement":
      extractFromExpression(
        stmt.test,
        file,
        lines,
        calls,
        jsxElements,
        references,
      );
      extractFromStatement(
        stmt.consequent,
        file,
        lines,
        calls,
        jsxElements,
        references,
      );
      if (stmt.alternate) {
        extractFromStatement(
          stmt.alternate,
          file,
          lines,
          calls,
          jsxElements,
          references,
        );
      }
      break;
    case "BlockStatement":
      for (const s of stmt.stmts) {
        extractFromStatement(s, file, lines, calls, jsxElements, references);
      }
      break;
    case "FunctionDeclaration":
      if (stmt.body) {
        extractFromStatement(
          stmt.body,
          file,
          lines,
          calls,
          jsxElements,
          references,
        );
      }
      break;
    case "ClassDeclaration":
      for (const member of stmt.body) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const m = member as any;
        if (m.function?.body) {
          extractFromStatement(
            m.function.body,
            file,
            lines,
            calls,
            jsxElements,
            references,
          );
        } else if (m.value?.body) {
          extractFromStatement(
            m.value.body,
            file,
            lines,
            calls,
            jsxElements,
            references,
          );
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
  lines: LineInfo[],
  calls: NormalizedCallExpression[],
  jsxElements: NormalizedJSXElement[],
  references: NormalizedReference[],
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
        extractFromExpression(
          arg.expression,
          file,
          lines,
          calls,
          jsxElements,
          references,
        );
      }
      break;
    }
    case "ArrowFunctionExpression":
      if (expr.body.type === "BlockStatement") {
        extractFromStatement(
          expr.body,
          file,
          lines,
          calls,
          jsxElements,
          references,
        );
      } else {
        extractFromExpression(
          expr.body,
          file,
          lines,
          calls,
          jsxElements,
          references,
        );
      }
      break;
    case "FunctionExpression":
      if (expr.body) {
        extractFromStatement(
          expr.body,
          file,
          lines,
          calls,
          jsxElements,
          references,
        );
      }
      break;
    case "ParenthesisExpression":
      extractFromExpression(
        expr.expression,
        file,
        lines,
        calls,
        jsxElements,
        references,
      );
      break;
    case "ConditionalExpression":
      extractFromExpression(
        expr.test,
        file,
        lines,
        calls,
        jsxElements,
        references,
      );
      extractFromExpression(
        expr.consequent,
        file,
        lines,
        calls,
        jsxElements,
        references,
      );
      extractFromExpression(
        expr.alternate,
        file,
        lines,
        calls,
        jsxElements,
        references,
      );
      break;
    case "SequenceExpression":
      for (const e of expr.expressions) {
        extractFromExpression(e, file, lines, calls, jsxElements, references);
      }
      break;
    case "AssignmentExpression":
      extractFromExpression(
        expr.right,
        file,
        lines,
        calls,
        jsxElements,
        references,
      );
      break;
    case "MemberExpression":
      {
        const symbol = calleeToString(expr);
        if (symbol) {
          references.push({
            symbol,
            location: toLocation(expr.span, file, lines),
          });
        }
      }
      break;
    case "JSXElement":
      jsxElements.push(extractJSXElement(expr, file, lines));
      // Recurse into children
      for (const child of expr.children) {
        if (child.type === "JSXExpressionContainer" && child.expression.type !== "JSXEmptyExpression") {
          extractFromExpression(
            child.expression,
            file,
            lines,
            calls,
            jsxElements,
            references,
          );
        } else if (child.type === "JSXElement") {
          extractFromExpression(
            child as unknown as Expression,
            file,
            lines,
            calls,
            jsxElements,
            references,
          );
        }
      }
      break;
    case "JSXFragment":
      for (const child of expr.children) {
        if (child.type === "JSXExpressionContainer" && child.expression.type !== "JSXEmptyExpression") {
          extractFromExpression(
            child.expression,
            file,
            lines,
            calls,
            jsxElements,
            references,
          );
        } else if (child.type === "JSXElement") {
          extractFromExpression(
            child as unknown as Expression,
            file,
            lines,
            calls,
            jsxElements,
            references,
          );
        }
      }
      break;
    case "TaggedTemplateExpression":
      extractFromExpression(
        expr.tag,
        file,
        lines,
        calls,
        jsxElements,
        references,
      );
      break;
    case "TemplateLiteral":
      for (const e of expr.expressions) {
        extractFromExpression(e, file, lines, calls, jsxElements, references);
      }
      break;
    case "ArrayExpression":
      for (const el of expr.elements) {
        if (el?.expression) {
          extractFromExpression(
            el.expression,
            file,
            lines,
            calls,
            jsxElements,
            references,
          );
        }
      }
      break;
    case "ObjectExpression":
      for (const prop of expr.properties) {
        if (prop.type === "KeyValueProperty") {
          extractFromExpression(
            (prop as { value: Expression }).value,
            file,
            lines,
            calls,
            jsxElements,
            references,
          );
        } else if (prop.type === "SpreadElement") {
          extractFromExpression(
            prop.arguments,
            file,
            lines,
            calls,
            jsxElements,
            references,
          );
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
function extractRequire(decl: any, _file: string, _lines: LineInfo[], _calls: NormalizedCallExpression[]): void {
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
function extractJSXElement(expr: any, file: string, lines: LineInfo[]): NormalizedJSXElement {
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
