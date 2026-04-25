import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("package release metadata", () => {
  it("publishes only runtime files and exposes a packed CLI smoke check", async () => {
    const packageJson = JSON.parse(
      await readFile(join(process.cwd(), "package.json"), "utf-8"),
    ) as {
      files?: string[];
      scripts?: Record<string, string>;
    };

    expect(packageJson.files).toEqual([
      "dist/",
      "authority-data/",
      "README.md",
      "LICENSE",
    ]);
    expect(packageJson.scripts?.["build"]).toBe(
      "npm run clean && tsc -p tsconfig.build.json",
    );
    expect(packageJson.scripts?.["smoke:pack"]).toBe(
      "npm run build && node scripts/smoke-packed-cli.mjs",
    );
  });
});
