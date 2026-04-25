import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  DEFAULT_CONFIG,
  DoxyConfigSchema,
  type DoxyConfig,
} from "../core/types/index.js";

export async function loadConfig(root: string): Promise<DoxyConfig> {
  const configPath = resolve(root, "doxy.config.json");

  try {
    const raw = await readFile(configPath, "utf-8");
    return DoxyConfigSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (isMissingFile(error)) {
      return DEFAULT_CONFIG;
    }
    throw error;
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
