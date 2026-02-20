import { describe, it, expect } from "vitest";
import { parseInlineSuppressions, isLineSuppressed } from "./index.js";

describe("parseInlineSuppressions", () => {
  describe("doxy-ignore (next-line)", () => {
    it("suppresses the next line", () => {
      const source = `// doxy-ignore deprecated-api\nconst factory = createFactory("div");`;
      const suppressions = parseInlineSuppressions(source);
      expect(suppressions).toHaveLength(1);
      expect(suppressions[0]!.kind).toBe("deprecated-api");
      expect(suppressions[0]!.startLine).toBe(2);
      expect(suppressions[0]!.endLine).toBe(2);
    });

    it("extracts reason after em dash", () => {
      const source = `// doxy-ignore deprecated-api — Legacy compat\nconst factory = createFactory("div");`;
      const suppressions = parseInlineSuppressions(source);
      expect(suppressions[0]!.reason).toBe("Legacy compat");
    });

    it("extracts reason after double dash", () => {
      const source = `// doxy-ignore deprecated-api -- Known issue\nconst factory = createFactory("div");`;
      const suppressions = parseInlineSuppressions(source);
      expect(suppressions[0]!.reason).toBe("Known issue");
    });

    it("extracts reason after colon", () => {
      const source = `// doxy-ignore deprecated-api: Used intentionally\nconst factory = createFactory("div");`;
      const suppressions = parseInlineSuppressions(source);
      expect(suppressions[0]!.reason).toBe("Used intentionally");
    });

    it("works without a reason", () => {
      const source = `// doxy-ignore deprecated-api\nconst factory = createFactory("div");`;
      const suppressions = parseInlineSuppressions(source);
      expect(suppressions[0]!.reason).toBeUndefined();
    });

    it("handles wildcard kind", () => {
      const source = `// doxy-ignore *\nconst factory = createFactory("div");`;
      const suppressions = parseInlineSuppressions(source);
      expect(suppressions[0]!.kind).toBe("*");
    });
  });

  describe("doxy-ignore-line (current line)", () => {
    it("suppresses the current line", () => {
      const source = `const factory = createFactory("div"); // doxy-ignore-line deprecated-api`;
      const suppressions = parseInlineSuppressions(source);
      expect(suppressions).toHaveLength(1);
      expect(suppressions[0]!.kind).toBe("deprecated-api");
      expect(suppressions[0]!.startLine).toBe(1);
      expect(suppressions[0]!.endLine).toBe(1);
    });

    it("extracts reason", () => {
      const source = `const factory = createFactory("div"); // doxy-ignore-line deprecated-api -- Legacy`;
      const suppressions = parseInlineSuppressions(source);
      expect(suppressions[0]!.reason).toBe("Legacy");
    });
  });

  describe("doxy-ignore-start/end (block)", () => {
    it("suppresses a block of lines", () => {
      const source = [
        "// code before",
        "/* doxy-ignore-start deprecated-api */",
        "const a = createFactory('a');",
        "const b = createFactory('b');",
        "/* doxy-ignore-end */",
        "// code after",
      ].join("\n");

      const suppressions = parseInlineSuppressions(source);
      expect(suppressions).toHaveLength(1);
      expect(suppressions[0]!.kind).toBe("deprecated-api");
      expect(suppressions[0]!.startLine).toBe(2);
      expect(suppressions[0]!.endLine).toBe(5);
    });

    it("extracts reason from block start", () => {
      const source = [
        "/* doxy-ignore-start deprecated-api — Legacy module */",
        "const a = createFactory('a');",
        "/* doxy-ignore-end */",
      ].join("\n");

      const suppressions = parseInlineSuppressions(source);
      expect(suppressions[0]!.reason).toBe("Legacy module");
    });
  });

  describe("all violation kinds", () => {
    const kinds = [
      "deprecated-api",
      "removed-api",
      "future-api",
      "wrong-arity",
      "wrong-param",
      "unknown-export",
    ];

    for (const kind of kinds) {
      it(`accepts ${kind}`, () => {
        const source = `// doxy-ignore ${kind}\ncode();`;
        const suppressions = parseInlineSuppressions(source);
        expect(suppressions).toHaveLength(1);
        expect(suppressions[0]!.kind).toBe(kind);
      });
    }

    it("ignores invalid kinds", () => {
      const source = `// doxy-ignore invalid-kind\ncode();`;
      const suppressions = parseInlineSuppressions(source);
      expect(suppressions).toHaveLength(0);
    });
  });

  describe("multiple suppressions", () => {
    it("handles multiple suppressions in one file", () => {
      const source = [
        "// doxy-ignore deprecated-api",
        "const a = createFactory('a');",
        "const b = findDOMNode(this); // doxy-ignore-line deprecated-api",
        "// doxy-ignore removed-api",
        "const c = something();",
      ].join("\n");

      const suppressions = parseInlineSuppressions(source);
      expect(suppressions).toHaveLength(3);
    });
  });
});

describe("isLineSuppressed", () => {
  it("returns the matching suppression for a covered line", () => {
    const suppressions = parseInlineSuppressions(
      `// doxy-ignore deprecated-api\nconst factory = createFactory("div");`,
    );
    const result = isLineSuppressed(2, "deprecated-api", suppressions);
    expect(result).toBeDefined();
    expect(result!.kind).toBe("deprecated-api");
  });

  it("returns undefined for an uncovered line", () => {
    const suppressions = parseInlineSuppressions(
      `// doxy-ignore deprecated-api\nconst factory = createFactory("div");`,
    );
    const result = isLineSuppressed(1, "deprecated-api", suppressions);
    expect(result).toBeUndefined();
  });

  it("returns undefined for wrong kind", () => {
    const suppressions = parseInlineSuppressions(
      `// doxy-ignore deprecated-api\nconst factory = createFactory("div");`,
    );
    const result = isLineSuppressed(2, "removed-api", suppressions);
    expect(result).toBeUndefined();
  });

  it("wildcard matches any kind", () => {
    const suppressions = parseInlineSuppressions(
      `// doxy-ignore *\nconst factory = createFactory("div");`,
    );
    expect(isLineSuppressed(2, "deprecated-api", suppressions)).toBeDefined();
    expect(isLineSuppressed(2, "removed-api", suppressions)).toBeDefined();
    expect(isLineSuppressed(2, "future-api", suppressions)).toBeDefined();
  });

  it("block suppression covers all lines in range", () => {
    const source = [
      "/* doxy-ignore-start deprecated-api */",
      "line2();",
      "line3();",
      "line4();",
      "/* doxy-ignore-end */",
    ].join("\n");

    const suppressions = parseInlineSuppressions(source);
    expect(isLineSuppressed(1, "deprecated-api", suppressions)).toBeDefined();
    expect(isLineSuppressed(2, "deprecated-api", suppressions)).toBeDefined();
    expect(isLineSuppressed(4, "deprecated-api", suppressions)).toBeDefined();
    expect(isLineSuppressed(5, "deprecated-api", suppressions)).toBeDefined();
  });
});
