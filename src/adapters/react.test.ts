import { describe, it, expect } from "vitest";
import { ReactAdapter } from "./react.js";
import { SwcParser } from "../parser/swc-bridge.js";
import type { RepoContext } from "../core/types/index.js";

const parser = new SwcParser();
const adapter = new ReactAdapter();

function resolveFromSource(source: string) {
  const ast = parser.parse(source, "test.tsx");
  return adapter.resolveSymbols(ast.imports, ast);
}

describe("ReactAdapter", () => {
  describe("metadata", () => {
    it("has correct id and packages", () => {
      expect(adapter.id).toBe("react");
      expect(adapter.packages).toContain("react");
      expect(adapter.packages).toContain("react-dom");
    });
  });

  describe("detect", () => {
    it("detects React from repo context", () => {
      const ctx: RepoContext = {
        root: "/test",
        packageManager: "npm",
        dependencies: { react: { resolvedVersion: "18.2.0", declaredRange: "^18" } },
        frameworks: [{ id: "react", name: "React", version: "18.2.0", confidence: "lockfile" }],
        tsconfig: {},
        contextHash: "abc",
      };
      expect(adapter.detect(ctx)).toBeDefined();
    });

    it("returns undefined when React not detected", () => {
      const ctx: RepoContext = {
        root: "/test",
        packageManager: "npm",
        dependencies: {},
        frameworks: [],
        tsconfig: {},
        contextHash: "abc",
      };
      expect(adapter.detect(ctx)).toBeUndefined();
    });
  });

  describe("resolveSymbols", () => {
    it("resolves named react imports", () => {
      const usages = resolveFromSource(
        `import { useState, useEffect } from "react";\nconst [x] = useState(0);\nuseEffect(() => {}, []);`,
      );
      expect(usages.find((u) => u.export === "useState")).toBeDefined();
      expect(usages.find((u) => u.export === "useEffect")).toBeDefined();
    });

    it("resolves React.* member access from default import", () => {
      const usages = resolveFromSource(
        `import React from "react";\nconst el = React.createElement("div");`,
      );
      const usage = usages.find((u) => u.export === "createElement");
      expect(usage).toBeDefined();
      expect(usage!.package).toBe("react");
    });

    it("resolves React.* member access from namespace import", () => {
      const usages = resolveFromSource(
        `import * as React from "react";\nconst [x] = React.useState(0);`,
      );
      const usage = usages.find((u) => u.export === "useState");
      expect(usage).toBeDefined();
      expect(usage!.package).toBe("react");
    });

    it("normalizes react-dom/client to react-dom", () => {
      const usages = resolveFromSource(
        `import { createRoot } from "react-dom/client";\nconst root = createRoot(document.body);`,
      );
      const usage = usages.find((u) => u.export === "createRoot");
      expect(usage).toBeDefined();
      expect(usage!.package).toBe("react-dom");
    });

    it("normalizes react-dom/server to react-dom", () => {
      const usages = resolveFromSource(
        `import { renderToString } from "react-dom/server";`,
      );
      // renderToString imported but not in our tracked packages will still show
      // as long as it's from react-dom
      const usage = usages.find((u) => u.export === "renderToString");
      expect(usage).toBeDefined();
      expect(usage!.package).toBe("react-dom");
    });

    it("ignores non-react imports", () => {
      const usages = resolveFromSource(
        `import { useState } from "react";\nimport { something } from "lodash";\nconst [x] = useState(0);\nsomething();`,
      );
      // Only react symbols should be resolved
      expect(usages.every((u) => u.package === "react" || u.package === "react-dom")).toBe(true);
    });

    it("handles combined default + named imports", () => {
      const usages = resolveFromSource(
        `import React, { useState } from "react";\nconst [x] = useState(0);\nconst el = React.createElement("div");`,
      );
      expect(usages.find((u) => u.export === "useState")).toBeDefined();
      expect(usages.find((u) => u.export === "createElement")).toBeDefined();
    });
  });
});
