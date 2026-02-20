/**
 * Golden-output test harness.
 *
 * Loads fixture mini-projects from fixtures/ and compares pipeline output
 * against expected-findings.json files.
 *
 * Usage in tests:
 *   import { loadFixture, assertFindingsMatch } from "../test/golden.js";
 *
 *   const fixture = await loadFixture("react-18-deprecated");
 *   const actual = await runPipeline(fixture);
 *   assertFindingsMatch(actual, fixture.expectedFindings);
 */
import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import type { Finding } from "../core/types/index.js";
import { z } from "zod";

/** Root of the fixtures directory */
const FIXTURES_ROOT = resolve(import.meta.dirname, "../../fixtures");

/** Schema for expected-findings.json */
export const ExpectedFindingsSchema = z.array(
  z.object({
    longId: z.string(),
    kind: z.string(),
    severity: z.string().optional(),
    message: z.string().optional(),
  }),
);

export type ExpectedFinding = z.infer<typeof ExpectedFindingsSchema>[number];

/** Metadata about a loaded fixture */
export interface LoadedFixture {
  /** Fixture name (directory name under fixtures/) */
  name: string;
  /** Absolute path to the fixture root */
  root: string;
  /** Parsed package.json */
  packageJson: Record<string, unknown>;
  /** Expected findings from expected-findings.json */
  expectedFindings: ExpectedFinding[];
  /** Optional doxy config if present */
  doxyConfig?: Record<string, unknown>;
}

/**
 * Load a fixture mini-project by name.
 * Reads package.json, expected-findings.json, and optionally doxy.config.json.
 */
export async function loadFixture(name: string): Promise<LoadedFixture> {
  const root = join(FIXTURES_ROOT, name);

  const packageJsonRaw = await readFile(join(root, "package.json"), "utf-8");
  const packageJson = JSON.parse(packageJsonRaw) as Record<string, unknown>;

  const expectedRaw = await readFile(
    join(root, "expected-findings.json"),
    "utf-8",
  );
  const expectedFindings = ExpectedFindingsSchema.parse(
    JSON.parse(expectedRaw),
  );

  let doxyConfig: Record<string, unknown> | undefined;
  try {
    const configRaw = await readFile(
      join(root, "doxy.config.json"),
      "utf-8",
    );
    doxyConfig = JSON.parse(configRaw) as Record<string, unknown>;
  } catch {
    // No config file — that's fine
  }

  return { name, root, packageJson, expectedFindings, doxyConfig };
}

/**
 * Compare actual findings against expected findings.
 *
 * Matches on longId and kind. Optionally checks severity and message.
 * Returns a diff-friendly result for test assertions.
 */
export function compareFindingsToExpected(
  actual: Finding[],
  expected: ExpectedFinding[],
): { missing: ExpectedFinding[]; unexpected: Finding[]; matched: number } {
  const actualByLongId = new Map(actual.map((f) => [f.longId, f]));
  const missing: ExpectedFinding[] = [];
  const matched: ExpectedFinding[] = [];

  for (const exp of expected) {
    const found = actualByLongId.get(exp.longId);
    if (!found || found.kind !== exp.kind) {
      missing.push(exp);
    } else {
      matched.push(exp);
      actualByLongId.delete(exp.longId);
    }
  }

  const unexpected = [...actualByLongId.values()];

  return { missing, unexpected, matched: matched.length };
}

/**
 * Assert that actual findings exactly match expected findings.
 * Throws with a descriptive message on mismatch.
 */
export function assertFindingsMatch(
  actual: Finding[],
  expected: ExpectedFinding[],
): void {
  const result = compareFindingsToExpected(actual, expected);

  const errors: string[] = [];
  if (result.missing.length > 0) {
    errors.push(
      `Missing expected findings:\n${result.missing.map((f) => `  - ${f.longId} (${f.kind})`).join("\n")}`,
    );
  }
  if (result.unexpected.length > 0) {
    errors.push(
      `Unexpected findings:\n${result.unexpected.map((f) => `  - ${f.longId} (${f.kind})`).join("\n")}`,
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Findings mismatch (${result.matched} matched):\n\n${errors.join("\n\n")}`,
    );
  }
}
