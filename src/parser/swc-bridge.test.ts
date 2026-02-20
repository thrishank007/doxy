import { describe, it, expect } from "vitest";
import { SwcParser } from "./swc-bridge.js";

const parser = new SwcParser();

describe("SwcParser", () => {
  describe("extensions", () => {
    it("handles .ts, .tsx, .js, .jsx", () => {
      expect(parser.extensions).toContain(".ts");
      expect(parser.extensions).toContain(".tsx");
      expect(parser.extensions).toContain(".js");
      expect(parser.extensions).toContain(".jsx");
    });
  });

  describe("imports", () => {
    it("extracts named imports", () => {
      const ast = parser.parse(
        `import { useState, useEffect } from "react";`,
        "test.ts",
      );
      expect(ast.imports).toHaveLength(1);
      expect(ast.imports[0]!.source).toBe("react");
      expect(ast.imports[0]!.specifiers).toHaveLength(2);
      expect(ast.imports[0]!.specifiers[0]!.imported).toBe("useState");
      expect(ast.imports[0]!.specifiers[1]!.imported).toBe("useEffect");
      expect(ast.imports[0]!.hasDefault).toBe(false);
      expect(ast.imports[0]!.hasNamespace).toBe(false);
    });

    it("extracts default import", () => {
      const ast = parser.parse(
        `import React from "react";`,
        "test.ts",
      );
      expect(ast.imports).toHaveLength(1);
      expect(ast.imports[0]!.hasDefault).toBe(true);
      expect(ast.imports[0]!.defaultLocal).toBe("React");
    });

    it("extracts namespace import", () => {
      const ast = parser.parse(
        `import * as React from "react";`,
        "test.ts",
      );
      expect(ast.imports).toHaveLength(1);
      expect(ast.imports[0]!.hasNamespace).toBe(true);
      expect(ast.imports[0]!.namespaceLocal).toBe("React");
    });

    it("extracts combined default + named imports", () => {
      const ast = parser.parse(
        `import React, { useState } from "react";`,
        "test.tsx",
      );
      expect(ast.imports).toHaveLength(1);
      expect(ast.imports[0]!.hasDefault).toBe(true);
      expect(ast.imports[0]!.defaultLocal).toBe("React");
      expect(ast.imports[0]!.specifiers).toHaveLength(1);
      expect(ast.imports[0]!.specifiers[0]!.imported).toBe("useState");
    });

    it("extracts aliased imports", () => {
      const ast = parser.parse(
        `import { useState as useMyState } from "react";`,
        "test.ts",
      );
      expect(ast.imports[0]!.specifiers[0]!.imported).toBe("useState");
      expect(ast.imports[0]!.specifiers[0]!.local).toBe("useMyState");
    });

    it("detects type-only imports", () => {
      const ast = parser.parse(
        `import type { ReactNode } from "react";`,
        "test.ts",
      );
      expect(ast.imports[0]!.isTypeOnly).toBe(true);
    });

    it("extracts multiple import statements", () => {
      const ast = parser.parse(
        `import { useState } from "react";\nimport { createRoot } from "react-dom/client";`,
        "test.ts",
      );
      expect(ast.imports).toHaveLength(2);
      expect(ast.imports[0]!.source).toBe("react");
      expect(ast.imports[1]!.source).toBe("react-dom/client");
    });

    it("has correct location info", () => {
      const ast = parser.parse(
        `import { useState } from "react";`,
        "test.ts",
      );
      expect(ast.imports[0]!.location.file).toBe("test.ts");
      expect(ast.imports[0]!.location.line).toBe(1);
    });
  });

  describe("call expressions", () => {
    it("extracts direct function calls", () => {
      const ast = parser.parse(
        `import { useState } from "react";\nconst [x, setX] = useState(0);`,
        "test.ts",
      );
      const call = ast.callExpressions.find((c) => c.callee === "useState");
      expect(call).toBeDefined();
      expect(call!.argCount).toBe(1);
    });

    it("extracts member expression calls", () => {
      const ast = parser.parse(
        `import React from "react";\nconst el = React.createElement("div");`,
        "test.tsx",
      );
      const call = ast.callExpressions.find(
        (c) => c.callee === "React.createElement",
      );
      expect(call).toBeDefined();
      expect(call!.argCount).toBe(1);
    });

    it("extracts calls inside functions", () => {
      const ast = parser.parse(
        `import { useState } from "react";\nfunction App() {\n  const [x, setX] = useState(0);\n  return x;\n}`,
        "test.ts",
      );
      const call = ast.callExpressions.find((c) => c.callee === "useState");
      expect(call).toBeDefined();
    });

    it("extracts calls inside arrow functions", () => {
      const ast = parser.parse(
        `import { useState } from "react";\nconst App = () => { const [x] = useState(0); return x; };`,
        "test.ts",
      );
      const call = ast.callExpressions.find((c) => c.callee === "useState");
      expect(call).toBeDefined();
    });

    it("counts arguments correctly", () => {
      const ast = parser.parse(
        `import { useReducer } from "react";\nconst [s, d] = useReducer(r, init, fn);`,
        "test.ts",
      );
      const call = ast.callExpressions.find((c) => c.callee === "useReducer");
      expect(call).toBeDefined();
      expect(call!.argCount).toBe(3);
    });

    it("extracts zero-arg calls", () => {
      const ast = parser.parse(
        `import { useId } from "react";\nconst id = useId();`,
        "test.ts",
      );
      const call = ast.callExpressions.find((c) => c.callee === "useId");
      expect(call).toBeDefined();
      expect(call!.argCount).toBe(0);
    });
  });

  describe("JSX elements", () => {
    it("extracts JSX elements", () => {
      const ast = parser.parse(
        `const el = <div className="test">Hello</div>;`,
        "test.tsx",
      );
      const div = ast.jsxElements.find((e) => e.tagName === "div");
      expect(div).toBeDefined();
      expect(div!.attributes).toContain("className");
    });

    it("extracts component JSX elements", () => {
      const ast = parser.parse(
        `import { Suspense } from "react";\nconst el = <Suspense fallback={null}><div /></Suspense>;`,
        "test.tsx",
      );
      const suspense = ast.jsxElements.find((e) => e.tagName === "Suspense");
      expect(suspense).toBeDefined();
      expect(suspense!.attributes).toContain("fallback");
    });

    it("extracts member expression JSX tags", () => {
      const ast = parser.parse(
        `import React from "react";\nconst el = <React.Fragment><div /></React.Fragment>;`,
        "test.tsx",
      );
      const fragment = ast.jsxElements.find((e) => e.tagName === "React.Fragment");
      expect(fragment).toBeDefined();
    });
  });

  describe("complex files", () => {
    it("parses a realistic React component", () => {
      const source = `
import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";

function App() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    document.title = \`Count: \${count}\`;
  }, [count]);

  const increment = useCallback(() => {
    setCount((c) => c + 1);
  }, []);

  return (
    <div className="app">
      <button onClick={increment}>{count}</button>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
`;
      const ast = parser.parse(source, "App.tsx");

      // Imports
      expect(ast.imports).toHaveLength(2);

      // Calls
      expect(ast.callExpressions.some((c) => c.callee === "useState")).toBe(true);
      expect(ast.callExpressions.some((c) => c.callee === "useEffect")).toBe(true);
      expect(ast.callExpressions.some((c) => c.callee === "useCallback")).toBe(true);
      expect(ast.callExpressions.some((c) => c.callee === "createRoot")).toBe(true);

      // JSX
      expect(ast.jsxElements.some((e) => e.tagName === "div")).toBe(true);
      expect(ast.jsxElements.some((e) => e.tagName === "button")).toBe(true);
      expect(ast.jsxElements.some((e) => e.tagName === "App")).toBe(true);
    });
  });
});
