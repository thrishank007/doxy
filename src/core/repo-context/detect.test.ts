import { describe, it, expect } from "vitest";
import { detectFrameworks } from "./detect.js";
import type { DependencyInfo } from "../types/index.js";

describe("detectFrameworks", () => {
  it("detects React from dependencies", () => {
    const deps: Record<string, DependencyInfo> = {
      react: { resolvedVersion: "18.2.0", declaredRange: "^18.0.0" },
      "react-dom": { resolvedVersion: "18.2.0", declaredRange: "^18.0.0" },
    };

    const frameworks = detectFrameworks(deps);
    expect(frameworks).toHaveLength(1);
    expect(frameworks[0]!.id).toBe("react");
    expect(frameworks[0]!.version).toBe("18.2.0");
    expect(frameworks[0]!.confidence).toBe("lockfile");
  });

  it("detects Next.js and React together", () => {
    const deps: Record<string, DependencyInfo> = {
      next: { resolvedVersion: "14.2.0", declaredRange: "^14.0.0" },
      react: { resolvedVersion: "18.2.0", declaredRange: "^18.0.0" },
      "react-dom": { resolvedVersion: "18.2.0", declaredRange: "^18.0.0" },
    };

    const frameworks = detectFrameworks(deps);
    expect(frameworks).toHaveLength(2);
    expect(frameworks.find((f) => f.id === "nextjs")).toBeDefined();
    expect(frameworks.find((f) => f.id === "react")).toBeDefined();
  });

  it("uses manifest confidence when no resolved version", () => {
    const deps: Record<string, DependencyInfo> = {
      react: { declaredRange: "^18.0.0" },
    };

    const frameworks = detectFrameworks(deps);
    expect(frameworks).toHaveLength(1);
    expect(frameworks[0]!.confidence).toBe("manifest");
    // Strips range prefix for version
    expect(frameworks[0]!.version).toBe("18.0.0");
  });

  it("applies config overrides", () => {
    const deps: Record<string, DependencyInfo> = {
      react: { resolvedVersion: "18.2.0", declaredRange: "^18.0.0" },
    };

    const frameworks = detectFrameworks(deps, { react: "19.0.0" });
    expect(frameworks).toHaveLength(1);
    expect(frameworks[0]!.version).toBe("19.0.0");
    expect(frameworks[0]!.confidence).toBe("manifest");
  });

  it("returns empty array when no frameworks detected", () => {
    const deps: Record<string, DependencyInfo> = {
      express: { resolvedVersion: "4.18.2", declaredRange: "^4.0.0" },
    };

    const frameworks = detectFrameworks(deps);
    expect(frameworks).toHaveLength(0);
  });

  it("detects framework from config override even without dependency", () => {
    const deps: Record<string, DependencyInfo> = {};

    const frameworks = detectFrameworks(deps, { nextjs: "14.0.0" });
    expect(frameworks).toHaveLength(1);
    expect(frameworks[0]!.id).toBe("nextjs");
    expect(frameworks[0]!.version).toBe("14.0.0");
  });
});
