import { describe, it, expect } from "vitest";
import {
  ApiSpecSchema,
  AuthorityDataFileSchema,
  AuthorityManifestSchema,
  DoxyConfigSchema,
  SuppressionRuleSchema,
  FindingSchema,
  FileCacheEntrySchema,
  CacheStoreSchema,
  BaselineSchema,
} from "./schemas.js";

// ─── Helpers ─────────────────────────────────────────────────────

function validApiSpec() {
  return {
    package: "react",
    export: "useState",
    kind: "hook",
    availableIn: ">=16.8.0",
    signatures: [
      {
        since: "16.8.0",
        minArity: 0,
        maxArity: 1,
        params: [{ name: "initialState", required: false }],
      },
    ],
    deprecations: [],
  };
}

function validFinding() {
  return {
    id: "dxy_a1b2c3d4",
    longId: "dxy:react/createFactory:src/App.tsx:14:5",
    kind: "deprecated-api",
    severity: "warning",
    location: { file: "src/App.tsx", line: 14, column: 5 },
    message: "createFactory is deprecated since React 16.13.0",
    symbol: {
      package: "react",
      export: "createFactory",
      installedVersion: "18.2.0",
    },
    fixes: [
      {
        description: "Use createElement instead",
        referenceUrl: "https://react.dev/reference/react/createElement",
      },
    ],
    authorityRef: {
      dataVersion: "1.0.0",
      specKey: "react/createFactory",
    },
  };
}

// ─── ApiSpecSchema ───────────────────────────────────────────────

describe("ApiSpecSchema", () => {
  it("accepts a valid spec", () => {
    const result = ApiSpecSchema.safeParse(validApiSpec());
    expect(result.success).toBe(true);
  });

  it("accepts all valid kinds", () => {
    const kinds = ["function", "component", "type", "constant", "class", "hook"];
    for (const kind of kinds) {
      const result = ApiSpecSchema.safeParse({ ...validApiSpec(), kind });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid kind", () => {
    const result = ApiSpecSchema.safeParse({
      ...validApiSpec(),
      kind: "widget",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = ApiSpecSchema.safeParse({ package: "react" });
    expect(result.success).toBe(false);
  });

  it("accepts spec with deprecations", () => {
    const spec = {
      ...validApiSpec(),
      deprecations: [
        {
          since: "16.13.0",
          message: "Use createElement instead",
          replacement: {
            package: "react",
            export: "createElement",
            migrationHint: "Replace createFactory with createElement",
          },
        },
      ],
    };
    const result = ApiSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
  });

  it("accepts spec with optional docsUrl", () => {
    const result = ApiSpecSchema.safeParse({
      ...validApiSpec(),
      docsUrl: "https://react.dev/reference/react/useState",
    });
    expect(result.success).toBe(true);
  });

  it("accepts signature with until field", () => {
    const spec = {
      ...validApiSpec(),
      signatures: [
        {
          since: "16.8.0",
          until: "19.0.0",
          minArity: 0,
          maxArity: 1,
          params: [{ name: "initialState", required: false }],
        },
      ],
    };
    const result = ApiSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
  });

  it("rejects negative minArity", () => {
    const spec = {
      ...validApiSpec(),
      signatures: [
        { since: "16.8.0", minArity: -1, maxArity: 1, params: [] },
      ],
    };
    const result = ApiSpecSchema.safeParse(spec);
    expect(result.success).toBe(false);
  });
});

// ─── AuthorityDataFileSchema ─────────────────────────────────────

describe("AuthorityDataFileSchema", () => {
  it("accepts a valid data file", () => {
    const result = AuthorityDataFileSchema.safeParse({
      schemaVersion: 1,
      package: "react",
      specs: [validApiSpec()],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty specs array", () => {
    const result = AuthorityDataFileSchema.safeParse({
      schemaVersion: 1,
      package: "react",
      specs: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects schemaVersion 0", () => {
    const result = AuthorityDataFileSchema.safeParse({
      schemaVersion: 0,
      package: "react",
      specs: [],
    });
    expect(result.success).toBe(false);
  });
});

// ─── AuthorityManifestSchema ─────────────────────────────────────

describe("AuthorityManifestSchema", () => {
  it("accepts a valid manifest", () => {
    const result = AuthorityManifestSchema.safeParse({
      schemaVersion: 1,
      dataVersion: "1.0.0",
      packages: [
        {
          name: "react",
          latestMappedVersion: "19.0.0",
          specFile: "react/18.x.json",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty packages array", () => {
    const result = AuthorityManifestSchema.safeParse({
      schemaVersion: 1,
      dataVersion: "1.0.0",
      packages: [],
    });
    expect(result.success).toBe(true);
  });
});

// ─── DoxyConfigSchema ────────────────────────────────────────────

describe("DoxyConfigSchema", () => {
  it("accepts an empty object (all defaults)", () => {
    const result = DoxyConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.severity).toBe("warning");
      expect(result.data.failOn).toBe("error");
      expect(result.data.include).toEqual(["src/**/*.{ts,tsx,js,jsx}"]);
      expect(result.data.suppressions).toEqual([]);
      expect(result.data.requireSuppressionReason).toBe(false);
      expect(result.data.authorityDataSources).toEqual(["builtin"]);
    }
  });

  it("accepts a fully specified config", () => {
    const result = DoxyConfigSchema.safeParse({
      include: ["lib/**/*.ts"],
      exclude: ["lib/**/*.test.ts"],
      severity: "info",
      failOn: "warning",
      frameworks: { react: "18.2.0" },
      pathAliases: { "@components": "./src/components" },
      suppressions: [
        {
          package: "react",
          export: "findDOMNode",
          kind: "removed-api",
          reason: "Legacy adapter",
        },
      ],
      requireSuppressionReason: true,
      authorityDataSources: ["builtin", "custom"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid severity", () => {
    const result = DoxyConfigSchema.safeParse({ severity: "critical" });
    expect(result.success).toBe(false);
  });
});

// ─── SuppressionRuleSchema ───────────────────────────────────────

describe("SuppressionRuleSchema", () => {
  it("accepts minimal rule (reason only)", () => {
    const result = SuppressionRuleSchema.safeParse({
      reason: "Known issue",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe("*");
    }
  });

  it("accepts fully specified rule", () => {
    const result = SuppressionRuleSchema.safeParse({
      package: "react",
      export: "findDOMNode",
      kind: "deprecated-api",
      paths: ["src/legacy/**"],
      reason: "Migrating in Q2",
    });
    expect(result.success).toBe(true);
  });

  it("accepts wildcard kind", () => {
    const result = SuppressionRuleSchema.safeParse({
      kind: "*",
      reason: "Suppress all",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing reason", () => {
    const result = SuppressionRuleSchema.safeParse({
      package: "react",
    });
    expect(result.success).toBe(false);
  });
});

// ─── FindingSchema ───────────────────────────────────────────────

describe("FindingSchema", () => {
  it("accepts a valid finding", () => {
    const result = FindingSchema.safeParse(validFinding());
    expect(result.success).toBe(true);
  });

  it("accepts finding with suppression", () => {
    const result = FindingSchema.safeParse({
      ...validFinding(),
      suppressed: { source: "inline", reason: "Known issue" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts finding with text replacement in fix", () => {
    const finding = {
      ...validFinding(),
      fixes: [
        {
          description: "Replace with createElement",
          replacement: {
            location: { file: "src/App.tsx", line: 14, column: 5 },
            newText: "createElement",
          },
        },
      ],
    };
    const result = FindingSchema.safeParse(finding);
    expect(result.success).toBe(true);
  });

  it("rejects invalid violation kind", () => {
    const result = FindingSchema.safeParse({
      ...validFinding(),
      kind: "invalid-kind",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid severity", () => {
    const result = FindingSchema.safeParse({
      ...validFinding(),
      severity: "critical",
    });
    expect(result.success).toBe(false);
  });

  it("rejects finding missing required fields", () => {
    const result = FindingSchema.safeParse({
      id: "dxy_a1b2c3d4",
      kind: "deprecated-api",
    });
    expect(result.success).toBe(false);
  });
});

// ─── FileCacheEntrySchema ────────────────────────────────────────

describe("FileCacheEntrySchema", () => {
  it("accepts a valid cache entry", () => {
    const result = FileCacheEntrySchema.safeParse({
      filePath: "src/App.tsx",
      contentHash: "abc123def456",
      authorityVersion: "1.0.0",
      repoContextHash: "ctx-hash-789",
      importedPackages: ["react", "react-dom"],
      packageVersions: { react: "18.2.0", "react-dom": "18.2.0" },
      unresolvedImports: [],
      findings: [validFinding()],
      analyzedAt: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it("accepts entry with no findings", () => {
    const result = FileCacheEntrySchema.safeParse({
      filePath: "src/clean.ts",
      contentHash: "abc123",
      authorityVersion: "1.0.0",
      repoContextHash: "ctx-hash",
      importedPackages: [],
      packageVersions: {},
      unresolvedImports: [],
      findings: [],
      analyzedAt: Date.now(),
    });
    expect(result.success).toBe(true);
  });
});

// ─── CacheStoreSchema ────────────────────────────────────────────

describe("CacheStoreSchema", () => {
  it("accepts a valid cache store", () => {
    const result = CacheStoreSchema.safeParse({
      entries: {},
      createdAt: Date.now(),
      doxyVersion: "0.1.0",
    });
    expect(result.success).toBe(true);
  });
});

// ─── BaselineSchema ──────────────────────────────────────────────

describe("BaselineSchema", () => {
  it("accepts a valid baseline", () => {
    const result = BaselineSchema.safeParse({
      findingIds: [
        "dxy:react/createFactory:src/App.tsx:14:5",
        "dxy:react/findDOMNode:src/Legacy.tsx:20:3",
      ],
      createdAt: Date.now(),
      doxyVersion: "0.1.0",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty baseline", () => {
    const result = BaselineSchema.safeParse({
      findingIds: [],
      createdAt: Date.now(),
      doxyVersion: "0.1.0",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing doxyVersion", () => {
    const result = BaselineSchema.safeParse({
      findingIds: [],
      createdAt: Date.now(),
    });
    expect(result.success).toBe(false);
  });
});
