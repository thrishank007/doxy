import { describe, expect, it } from "vitest";
import { loadFixture } from "../test/golden.js";
import { runVerify } from "./verify.js";

describe("runVerify", () => {
  it("renders human output by default", async () => {
    const fixture = await loadFixture("react-18-deprecated");
    const result = await runVerify({ root: fixture.root });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("src/App.tsx");
    expect(result.stdout).toContain("deprecated-api");
    expect(result.stdout).toContain("react.createFactory is deprecated");
    expect(result.stderr).toBe("");
  });

  it("renders JSON output for llm and tooling consumers", async () => {
    const fixture = await loadFixture("react-19-removed");
    const result = await runVerify({ root: fixture.root, format: "json" });
    const parsed = JSON.parse(result.stdout) as {
      findings: Array<{ longId: string; kind: string }>;
      summary: { total: number; errors: number; warnings: number };
    };

    expect(result.exitCode).toBe(1);
    expect(parsed.findings).toHaveLength(3);
    expect(parsed.findings[0]?.longId).toBe(
      "dxy:react/createFactory:src/App.tsx:6:17",
    );
    expect(parsed.summary.errors).toBe(3);
  });

  it("renders JSONL output with a trailing summary record", async () => {
    const fixture = await loadFixture("react-future-api");
    const result = await runVerify({ root: fixture.root, format: "jsonl" });
    const lines = result.stdout.trim().split("\n").map((line) => JSON.parse(line) as {
      type: string;
    });

    expect(result.exitCode).toBe(1);
    expect(lines).toHaveLength(4);
    expect(lines[0]?.type).toBe("finding");
    expect(lines.at(-1)?.type).toBe("summary");
  });
});
