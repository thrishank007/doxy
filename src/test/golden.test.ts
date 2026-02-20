import { describe, it, expect } from "vitest";
import {
  loadFixture,
  compareFindingsToExpected,
  assertFindingsMatch,
  type ExpectedFinding,
} from "./golden.js";
import type { Finding } from "../core/types/index.js";

/** Helper to create a minimal Finding for testing the harness itself */
function makeFinding(overrides: Partial<Finding> & { longId: string; kind: Finding["kind"] }): Finding {
  return {
    id: "dxy_test1234",
    severity: "warning",
    location: { file: "src/App.tsx", line: 1, column: 0 },
    message: "test message",
    symbol: {
      package: "react",
      export: "test",
      installedVersion: "18.2.0",
    },
    fixes: [],
    authorityRef: {
      dataVersion: "1.0.0",
      specKey: "react/test",
    },
    ...overrides,
  };
}

describe("compareFindingsToExpected", () => {
  it("reports all matched when findings are identical", () => {
    const actual: Finding[] = [
      makeFinding({
        longId: "dxy:react/createFactory:src/App.tsx:14:5",
        kind: "deprecated-api",
      }),
    ];
    const expected: ExpectedFinding[] = [
      {
        longId: "dxy:react/createFactory:src/App.tsx:14:5",
        kind: "deprecated-api",
      },
    ];

    const result = compareFindingsToExpected(actual, expected);
    expect(result.matched).toBe(1);
    expect(result.missing).toEqual([]);
    expect(result.unexpected).toEqual([]);
  });

  it("reports missing when expected finding not in actual", () => {
    const actual: Finding[] = [];
    const expected: ExpectedFinding[] = [
      {
        longId: "dxy:react/createFactory:src/App.tsx:14:5",
        kind: "deprecated-api",
      },
    ];

    const result = compareFindingsToExpected(actual, expected);
    expect(result.matched).toBe(0);
    expect(result.missing).toHaveLength(1);
  });

  it("reports unexpected when actual finding not in expected", () => {
    const actual: Finding[] = [
      makeFinding({
        longId: "dxy:react/createFactory:src/App.tsx:14:5",
        kind: "deprecated-api",
      }),
    ];
    const expected: ExpectedFinding[] = [];

    const result = compareFindingsToExpected(actual, expected);
    expect(result.matched).toBe(0);
    expect(result.unexpected).toHaveLength(1);
  });

  it("handles kind mismatch as missing + unexpected", () => {
    const actual: Finding[] = [
      makeFinding({
        longId: "dxy:react/createFactory:src/App.tsx:14:5",
        kind: "removed-api",
      }),
    ];
    const expected: ExpectedFinding[] = [
      {
        longId: "dxy:react/createFactory:src/App.tsx:14:5",
        kind: "deprecated-api",
      },
    ];

    const result = compareFindingsToExpected(actual, expected);
    expect(result.matched).toBe(0);
    expect(result.missing).toHaveLength(1);
    expect(result.unexpected).toHaveLength(1);
  });
});

describe("assertFindingsMatch", () => {
  it("does not throw when findings match", () => {
    const actual: Finding[] = [
      makeFinding({
        longId: "dxy:react/createFactory:src/App.tsx:14:5",
        kind: "deprecated-api",
      }),
    ];
    const expected: ExpectedFinding[] = [
      {
        longId: "dxy:react/createFactory:src/App.tsx:14:5",
        kind: "deprecated-api",
      },
    ];

    expect(() => assertFindingsMatch(actual, expected)).not.toThrow();
  });

  it("throws with descriptive error on mismatch", () => {
    const actual: Finding[] = [];
    const expected: ExpectedFinding[] = [
      {
        longId: "dxy:react/createFactory:src/App.tsx:14:5",
        kind: "deprecated-api",
      },
    ];

    expect(() => assertFindingsMatch(actual, expected)).toThrow(
      /Missing expected findings/,
    );
  });
});

describe("loadFixture", () => {
  it("loads the react-clean fixture", async () => {
    const fixture = await loadFixture("react-clean");
    expect(fixture.name).toBe("react-clean");
    expect(fixture.packageJson).toBeDefined();
    expect(fixture.expectedFindings).toEqual([]);
  });

  it("loads the react-18-deprecated fixture", async () => {
    const fixture = await loadFixture("react-18-deprecated");
    expect(fixture.name).toBe("react-18-deprecated");
    expect(fixture.expectedFindings.length).toBeGreaterThan(0);
    for (const f of fixture.expectedFindings) {
      expect(f.longId).toMatch(/^dxy:/);
      expect(f.kind).toBeDefined();
    }
  });

  it("throws on nonexistent fixture", async () => {
    await expect(loadFixture("nonexistent-fixture")).rejects.toThrow();
  });
});
