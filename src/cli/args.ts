import type { Severity } from "../core/types/index.js";
import type { ReportFormat } from "./reporters.js";

export interface ParsedVerifyArgs {
  files: string[];
  format: ReportFormat;
  failOn?: Severity;
}

const SEVERITIES = new Set<Severity>(["error", "warning", "info"]);

export function parseVerifyArgs(rawArgs: string[]): ParsedVerifyArgs {
  const args = rawArgs[0] === "verify" ? rawArgs.slice(1) : rawArgs;
  let format: ReportFormat = "human";
  let failOn: Severity | undefined;
  const files: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;

    if (arg === "--json") {
      format = "json";
      continue;
    }

    if (arg === "--jsonl") {
      format = "jsonl";
      continue;
    }

    if (arg === "--fail-on") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Missing value for --fail-on.");
      }
      failOn = parseSeverity(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--fail-on=")) {
      failOn = parseSeverity(arg.slice("--fail-on=".length));
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown flag: ${arg}`);
    }

    files.push(arg);
  }

  if (args.includes("--json") && args.includes("--jsonl")) {
    throw new Error("Choose either --json or --jsonl, not both.");
  }

  return { files, format, failOn };
}

function parseSeverity(value: string): Severity {
  if (SEVERITIES.has(value as Severity)) {
    return value as Severity;
  }

  throw new Error(
    `Invalid --fail-on severity: ${value}. Expected error, warning, or info.`,
  );
}
