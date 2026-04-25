import { analyzeProject } from "../core/analyzer/index.js";
import { ExitCode, type Finding, type Severity } from "../core/types/index.js";
import { loadConfig } from "./config.js";
import {
  renderReport,
  summarizeFindings,
  type ReportFormat,
} from "./reporters.js";

export interface RunVerifyOptions {
  root: string;
  files?: string[];
  format?: ReportFormat;
  failOn?: Severity;
}

export interface RunVerifyResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  findings: Finding[];
}

const SEVERITY_ORDER: Record<Severity, number> = {
  info: 0,
  warning: 1,
  error: 2,
};

export async function runVerify(
  options: RunVerifyOptions,
): Promise<RunVerifyResult> {
  try {
    const config = await loadConfig(options.root);
    const result = await analyzeProject({
      root: options.root,
      files: options.files,
      config,
    });

    const failOn = options.failOn ?? config.failOn;
    const findings = result.findings.filter((finding) =>
      passesSeverityFloor(finding.severity, config.severity)
    );
    const summary = summarizeFindings(findings);
    const exitCode = summary.total > 0 &&
      findings.some((finding) => passesSeverityFloor(finding.severity, failOn))
      ? ExitCode.VIOLATIONS_FOUND
      : ExitCode.CLEAN;

    return {
      stdout: renderReport(findings, options.format ?? "human"),
      stderr: "",
      exitCode,
      findings,
    };
  } catch (error) {
    return {
      stdout: "",
      stderr: error instanceof Error ? `${error.message}\n` : "Unknown error\n",
      exitCode: ExitCode.INTERNAL_ERROR,
      findings: [],
    };
  }
}

function passesSeverityFloor(
  actual: Severity,
  floor: Severity,
): boolean {
  return SEVERITY_ORDER[actual] >= SEVERITY_ORDER[floor];
}
