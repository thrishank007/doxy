/**
 * Inline Suppression Parser — extracts doxy-ignore comments from source text.
 *
 * Supported comment formats:
 *   // doxy-ignore <kind>[ — reason]       → suppresses next line
 *   // doxy-ignore-line <kind>[ — reason]  → suppresses current line (end-of-line)
 *   /* doxy-ignore-start <kind>[ — reason] * / ... /* doxy-ignore-end * /  → suppresses block
 *
 * Kind values: deprecated-api, removed-api, future-api, wrong-arity, wrong-param, unknown-export, or * for all.
 * Reason is freeform text after "—", "--", or ":".
 */
import type { ViolationKind, InlineSuppression } from "../types/index.js";

const VALID_KINDS = new Set<string>([
  "deprecated-api",
  "removed-api",
  "future-api",
  "wrong-arity",
  "wrong-param",
  "unknown-export",
  "*",
]);

/**
 * Regex patterns for suppression comments.
 * Captured groups: (1) kind, (2) optional reason after separator
 */
const IGNORE_NEXT_LINE = /doxy-ignore\s+([\w*-]+)(?:\s*(?:--|—|:)\s*(.+?))?$/;
const IGNORE_CURRENT_LINE = /doxy-ignore-line\s+([\w*-]+)(?:\s*(?:--|—|:)\s*(.+?))?$/;
const IGNORE_BLOCK_START = /doxy-ignore-start\s+([\w*-]+)(?:\s*(?:--|—|:)\s*(.+))?/;
const IGNORE_BLOCK_END = /doxy-ignore-end/;

/**
 * Extract inline suppression directives from source text.
 */
export function parseInlineSuppressions(source: string): InlineSuppression[] {
  const suppressions: InlineSuppression[] = [];
  const lines = source.split("\n");

  // Track open block suppressions: { kind, reason, startLine }
  const openBlocks: Array<{ kind: ViolationKind | "*"; reason?: string; startLine: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNum = i + 1; // 1-based

    // Check for block end first
    if (IGNORE_BLOCK_END.test(line)) {
      const last = openBlocks.pop();
      if (last) {
        suppressions.push({
          kind: last.kind,
          reason: last.reason,
          startLine: last.startLine,
          endLine: lineNum,
        });
      }
      continue;
    }

    // Check for block start
    const blockStartMatch = line.match(IGNORE_BLOCK_START);
    if (blockStartMatch && !IGNORE_CURRENT_LINE.test(line) && !IGNORE_NEXT_LINE.test(line.replace(IGNORE_BLOCK_START, ""))) {
      const kind = blockStartMatch[1]!;
      if (VALID_KINDS.has(kind)) {
        openBlocks.push({
          kind: kind as ViolationKind | "*",
          reason: cleanBlockReason(blockStartMatch[2]),
          startLine: lineNum,
        });
      }
      continue;
    }

    // Check for ignore-line (end-of-line comment suppressing current line)
    const lineMatch = line.match(IGNORE_CURRENT_LINE);
    if (lineMatch) {
      const kind = lineMatch[1]!;
      if (VALID_KINDS.has(kind)) {
        suppressions.push({
          kind: kind as ViolationKind | "*",
          reason: lineMatch[2]?.trim(),
          startLine: lineNum,
          endLine: lineNum,
        });
      }
      continue;
    }

    // Check for doxy-ignore (next-line suppression)
    const nextLineMatch = line.match(IGNORE_NEXT_LINE);
    if (nextLineMatch) {
      const kind = nextLineMatch[1]!;
      if (VALID_KINDS.has(kind)) {
        suppressions.push({
          kind: kind as ViolationKind | "*",
          reason: nextLineMatch[2]?.trim(),
          startLine: lineNum + 1,
          endLine: lineNum + 1,
        });
      }
      continue;
    }
  }

  return suppressions;
}

// Strip trailing comment closers from block suppression reasons.
function cleanBlockReason(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.replace(/\s*\*\/\s*$/, "").trim() || undefined;
}

/**
 * Check if a finding at a given line is suppressed by any inline suppression.
 */
export function isLineSuppressed(
  line: number,
  kind: ViolationKind,
  suppressions: InlineSuppression[],
): InlineSuppression | undefined {
  for (const sup of suppressions) {
    if (line < sup.startLine || line > sup.endLine) continue;
    if (sup.kind === "*" || sup.kind === kind) return sup;
  }
  return undefined;
}
