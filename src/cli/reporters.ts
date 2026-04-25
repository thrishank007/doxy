import type { Finding } from "../core/types/index.js";

export type ReportFormat = "human" | "json" | "jsonl";

export interface ReportSummary {
  total: number;
  errors: number;
  warnings: number;
  info: number;
}

export function summarizeFindings(findings: Finding[]): ReportSummary {
  return {
    total: findings.length,
    errors: findings.filter((finding) => finding.severity === "error").length,
    warnings: findings.filter((finding) => finding.severity === "warning").length,
    info: findings.filter((finding) => finding.severity === "info").length,
  };
}

export function renderReport(
  findings: Finding[],
  format: ReportFormat,
): string {
  const summary = summarizeFindings(findings);

  switch (format) {
    case "json":
      return JSON.stringify(
        {
          tool: "doxy",
          version: "0.1.0",
          findings,
          summary,
        },
        null,
        2,
      );
    case "jsonl":
      return [
        ...findings.map((finding) => JSON.stringify({ type: "finding", finding })),
        JSON.stringify({ type: "summary", summary }),
      ].join("\n");
    case "human":
    default:
      return renderHuman(findings, summary);
  }
}

function renderHuman(findings: Finding[], summary: ReportSummary): string {
  if (findings.length === 0) {
    return "0 findings\n";
  }

  const lines: string[] = [];
  let currentFile: string | undefined;

  for (const finding of findings) {
    if (finding.location.file !== currentFile) {
      if (currentFile) {
        lines.push("");
      }
      currentFile = finding.location.file;
      lines.push(currentFile);
    }

    lines.push(
      `  ${finding.location.line}:${finding.location.column}  ${finding.severity}  ${finding.message}  ${finding.kind}  ${finding.id}`,
    );

    const bestFix = finding.fixes[0];
    if (bestFix?.description) {
      lines.push(`             ${bestFix.description}`);
    }
  }

  lines.push("");
  lines.push(
    `${summary.total} findings (${summary.errors} errors, ${summary.warnings} warnings, ${summary.info} info)`,
  );

  return `${lines.join("\n")}\n`;
}
