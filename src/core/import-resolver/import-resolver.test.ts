import { describe, it, expect } from "vitest";
import { resolveImports, extractPackageName } from "./index.js";
import { SwcParser } from "../../parser/swc-bridge.js";

const parser = new SwcParser();

function resolve(source: string, tracked?: Set<string>) {
  const ast = parser.parse(source, "test.tsx");
  return resolveImports(ast, tracked);
}

describe("extractPackageName", () => {
  it("extracts simple package names", () => {
    expect(extractPackageName("react")).toBe("react");
    expect(extractPackageName("react-dom")).toBe("react-dom");
  });

  it("extracts from subpath imports", () => {
    expect(extractPackageName("react-dom/client")).toBe("react-dom");
    expect(extractPackageName("next/navigation")).toBe("next");
  });

  it("extracts scoped packages", () => {
    expect(extractPackageName("@tanstack/react-query")).toBe("@tanstack/react-query");
    expect(extractPackageName("@types/node")).toBe("@types/node");
  });

  it("extracts scoped packages with subpath", () => {
    expect(extractPackageName("@tanstack/react-query/build")).toBe("@tanstack/react-query");
  });

  it("returns undefined for relative imports", () => {
    expect(extractPackageName("./utils")).toBeUndefined();
    expect(extractPackageName("../lib/foo")).toBeUndefined();
    expect(extractPackageName("/absolute/path")).toBeUndefined();
  });
});

describe("resolveImports", () => {
  it("resolves named imports", () => {
    const { usages } = resolve(
      `import { useState } from "react";\nconst [x] = useState(0);`,
    );
    const usage = usages.find((u) => u.export === "useState");
    expect(usage).toBeDefined();
    expect(usage!.package).toBe("react");
    expect(usage!.importKind).toBe("named");
    expect(usage!.usageSites.length).toBeGreaterThanOrEqual(1);
  });

  it("resolves namespace imports (React.useState)", () => {
    const { usages } = resolve(
      `import * as React from "react";\nconst [x] = React.useState(0);`,
    );
    const usage = usages.find((u) => u.export === "useState");
    expect(usage).toBeDefined();
    expect(usage!.package).toBe("react");
    expect(usage!.importKind).toBe("namespace");
  });

  it("resolves default import with member access (React.createElement)", () => {
    const { usages } = resolve(
      `import React from "react";\nconst el = React.createElement("div");`,
    );
    const usage = usages.find((u) => u.export === "createElement");
    expect(usage).toBeDefined();
    expect(usage!.package).toBe("react");
    expect(usage!.importKind).toBe("default");
  });

  it("resolves aliased imports", () => {
    const { usages } = resolve(
      `import { useState as useMyState } from "react";\nconst [x] = useMyState(0);`,
    );
    const usage = usages.find((u) => u.export === "useState");
    expect(usage).toBeDefined();
    expect(usage!.package).toBe("react");
  });

  it("tracks argument count", () => {
    const { usages } = resolve(
      `import { useReducer } from "react";\nconst [s, d] = useReducer(r, init, fn);`,
    );
    const usage = usages.find((u) => u.export === "useReducer");
    expect(usage).toBeDefined();
    const callSite = usage!.usageSites.find((s) => s.argCount !== undefined);
    expect(callSite).toBeDefined();
    expect(callSite!.argCount).toBe(3);
  });

  it("skips type-only imports", () => {
    const { usages } = resolve(
      `import type { ReactNode } from "react";`,
    );
    expect(usages).toHaveLength(0);
  });

  it("skips relative imports", () => {
    const { usages } = resolve(
      `import { foo } from "./utils";\nfoo();`,
    );
    expect(usages).toHaveLength(0);
  });

  it("tracks imported packages", () => {
    const { importedPackages } = resolve(
      `import { useState } from "react";\nimport { createRoot } from "react-dom/client";`,
    );
    expect(importedPackages).toContain("react");
    expect(importedPackages).toContain("react-dom");
  });

  it("tracks unresolved imports when trackedPackages filter is used", () => {
    const tracked = new Set(["react"]);
    const { unresolvedImports } = resolve(
      `import { useState } from "react";\nimport { something } from "lodash";`,
      tracked,
    );
    expect(unresolvedImports).toContain("lodash");
  });

  it("creates import-only usages for imported-but-uncalled symbols", () => {
    const { usages } = resolve(
      `import { createFactory } from "react";`,
    );
    // createFactory is imported but not called — should still appear
    const usage = usages.find((u) => u.export === "createFactory");
    expect(usage).toBeDefined();
    expect(usage!.usageSites).toHaveLength(1);
  });

  it("resolves multiple calls to the same symbol", () => {
    const { usages } = resolve(
      `import { useState } from "react";\nconst [a] = useState(0);\nconst [b] = useState("x");`,
    );
    const usage = usages.find((u) => u.export === "useState");
    expect(usage).toBeDefined();
    // At least 2 call sites + possibly 1 import-only site
    expect(usage!.usageSites.length).toBeGreaterThanOrEqual(2);
  });
});
