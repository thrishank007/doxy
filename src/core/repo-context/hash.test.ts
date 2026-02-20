import { describe, it, expect } from "vitest";
import { computeContextHash } from "./hash.js";
import type { DependencyInfo, DetectedFramework, TsconfigInfo } from "../types/index.js";

describe("computeContextHash", () => {
  const baseDeps: Record<string, DependencyInfo> = {
    react: { resolvedVersion: "18.2.0", declaredRange: "^18.0.0" },
  };
  const baseFrameworks: DetectedFramework[] = [
    { id: "react", name: "React", version: "18.2.0", confidence: "lockfile" },
  ];
  const baseTsconfig: TsconfigInfo = { jsx: "react-jsx" };

  it("produces a 64-char hex string (SHA-256)", () => {
    const hash = computeContextHash(baseDeps, baseFrameworks, baseTsconfig);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic", () => {
    const hash1 = computeContextHash(baseDeps, baseFrameworks, baseTsconfig);
    const hash2 = computeContextHash(baseDeps, baseFrameworks, baseTsconfig);
    expect(hash1).toBe(hash2);
  });

  it("changes when dependency version changes", () => {
    const hash1 = computeContextHash(baseDeps, baseFrameworks, baseTsconfig);
    const altDeps = { react: { resolvedVersion: "19.0.0", declaredRange: "^19.0.0" } };
    const hash2 = computeContextHash(altDeps, baseFrameworks, baseTsconfig);
    expect(hash1).not.toBe(hash2);
  });

  it("changes when framework version changes", () => {
    const hash1 = computeContextHash(baseDeps, baseFrameworks, baseTsconfig);
    const altFw: DetectedFramework[] = [
      { id: "react", name: "React", version: "19.0.0", confidence: "lockfile" },
    ];
    const hash2 = computeContextHash(baseDeps, altFw, baseTsconfig);
    expect(hash1).not.toBe(hash2);
  });

  it("changes when tsconfig paths change", () => {
    const hash1 = computeContextHash(baseDeps, baseFrameworks, baseTsconfig);
    const altTsconfig: TsconfigInfo = {
      jsx: "react-jsx",
      paths: { "@/*": ["./src/*"] },
    };
    const hash2 = computeContextHash(baseDeps, baseFrameworks, altTsconfig);
    expect(hash1).not.toBe(hash2);
  });

  it("is order-independent for dependencies", () => {
    const deps1: Record<string, DependencyInfo> = {
      a: { resolvedVersion: "1.0.0", declaredRange: "^1.0.0" },
      b: { resolvedVersion: "2.0.0", declaredRange: "^2.0.0" },
    };
    const deps2: Record<string, DependencyInfo> = {
      b: { resolvedVersion: "2.0.0", declaredRange: "^2.0.0" },
      a: { resolvedVersion: "1.0.0", declaredRange: "^1.0.0" },
    };
    const hash1 = computeContextHash(deps1, [], {});
    const hash2 = computeContextHash(deps2, [], {});
    expect(hash1).toBe(hash2);
  });

  it("handles empty inputs", () => {
    const hash = computeContextHash({}, [], {});
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
