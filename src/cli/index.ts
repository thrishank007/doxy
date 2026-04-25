#!/usr/bin/env node

import { ExitCode } from "../core/types/index.js";
import { parseVerifyArgs } from "./args.js";
import { runVerify } from "./verify.js";

async function main(): Promise<void> {
  let args: ReturnType<typeof parseVerifyArgs>;
  try {
    args = parseVerifyArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(error instanceof Error ? `${error.message}\n` : "Invalid arguments.\n");
    process.exitCode = ExitCode.CONFIG_ERROR;
    return;
  }

  const result = await runVerify({
    root: process.cwd(),
    files: args.files,
    format: args.format,
    failOn: args.failOn,
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
