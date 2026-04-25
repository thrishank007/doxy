#!/usr/bin/env node

import { ExitCode } from "../core/types/index.js";
import { runVerify } from "./verify.js";

type ReportFormat = "human" | "json" | "jsonl";

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const args = rawArgs[0] === "verify" ? rawArgs.slice(1) : rawArgs;

  let format: ReportFormat = "human";
  const files: string[] = [];

  for (const arg of args) {
    if (arg === "--json") {
      format = "json";
      continue;
    }
    if (arg === "--jsonl") {
      format = "jsonl";
      continue;
    }
    files.push(arg);
  }

  if (args.includes("--json") && args.includes("--jsonl")) {
    process.stderr.write("Choose either --json or --jsonl, not both.\n");
    process.exitCode = ExitCode.CONFIG_ERROR;
    return;
  }

  const result = await runVerify({
    root: process.cwd(),
    files,
    format,
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  process.exitCode = result.exitCode;
}

await main();
