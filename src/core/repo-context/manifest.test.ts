import { describe, it, expect } from "vitest";
import { buildDependencyMap } from "./manifest.js";

describe("buildDependencyMap", () => {
  it("merges dependencies with resolved versions", () => {
    const manifest = {
      dependencies: { react: "^18.0.0", "react-dom": "^18.0.0" },
    };
    const resolved = { react: "18.2.0", "react-dom": "18.2.0" };

    const deps = buildDependencyMap(manifest, resolved);
    expect(deps["react"]).toEqual({
      resolvedVersion: "18.2.0",
      declaredRange: "^18.0.0",
    });
    expect(deps["react-dom"]).toEqual({
      resolvedVersion: "18.2.0",
      declaredRange: "^18.0.0",
    });
  });

  it("includes devDependencies", () => {
    const manifest = {
      dependencies: { react: "^18.0.0" },
      devDependencies: { typescript: "^5.0.0", vitest: "^3.0.0" },
    };
    const resolved = {
      react: "18.2.0",
      typescript: "5.3.3",
      vitest: "3.2.4",
    };

    const deps = buildDependencyMap(manifest, resolved);
    expect(deps["typescript"]).toEqual({
      resolvedVersion: "5.3.3",
      declaredRange: "^5.0.0",
    });
    expect(deps["vitest"]).toEqual({
      resolvedVersion: "3.2.4",
      declaredRange: "^3.0.0",
    });
  });

  it("dependencies override devDependencies on name conflict", () => {
    const manifest = {
      dependencies: { react: "^18.0.0" },
      devDependencies: { react: "^17.0.0" },
    };
    const resolved = { react: "18.2.0" };

    const deps = buildDependencyMap(manifest, resolved);
    expect(deps["react"]!.declaredRange).toBe("^18.0.0");
  });

  it("handles missing resolved version gracefully", () => {
    const manifest = {
      dependencies: { react: "^18.0.0" },
    };
    const resolved = {};

    const deps = buildDependencyMap(manifest, resolved);
    expect(deps["react"]).toEqual({
      resolvedVersion: undefined,
      declaredRange: "^18.0.0",
    });
  });

  it("handles empty manifest", () => {
    const deps = buildDependencyMap({}, {});
    expect(Object.keys(deps)).toHaveLength(0);
  });
});
