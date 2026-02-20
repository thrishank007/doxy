import { describe, it, expect } from "vitest";
import { readTsconfig } from "./tsconfig.js";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "doxy-tsconfig-test-"));
}

describe("readTsconfig", () => {
  it("reads paths, baseUrl, and jsx from tsconfig", async () => {
    const dir = await makeTempDir();
    try {
      await writeFile(
        join(dir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            jsx: "react-jsx",
            paths: { "@/*": ["./src/*"] },
          },
        }),
      );

      const result = await readTsconfig(dir);
      expect(result.baseUrl).toBe(".");
      expect(result.jsx).toBe("react-jsx");
      expect(result.paths).toEqual({ "@/*": ["./src/*"] });
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("returns empty object when no tsconfig exists", async () => {
    const dir = await makeTempDir();
    try {
      const result = await readTsconfig(dir);
      expect(result).toEqual({});
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("handles tsconfig with comments", async () => {
    const dir = await makeTempDir();
    try {
      await writeFile(
        join(dir, "tsconfig.json"),
        `{
  // This is a comment
  "compilerOptions": {
    /* Multi-line
       comment */
    "jsx": "react-jsx",
    "strict": true, // trailing comma below
  }
}`,
      );

      const result = await readTsconfig(dir);
      expect(result.jsx).toBe("react-jsx");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("follows extends chain", async () => {
    const dir = await makeTempDir();
    try {
      await writeFile(
        join(dir, "tsconfig.base.json"),
        JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            jsx: "react",
          },
        }),
      );
      await writeFile(
        join(dir, "tsconfig.json"),
        JSON.stringify({
          extends: "./tsconfig.base",
          compilerOptions: {
            jsx: "react-jsx",
          },
        }),
      );

      const result = await readTsconfig(dir);
      expect(result.jsx).toBe("react-jsx"); // child overrides
      expect(result.baseUrl).toBe("."); // inherited from parent
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("handles missing fields gracefully", async () => {
    const dir = await makeTempDir();
    try {
      await writeFile(
        join(dir, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { strict: true } }),
      );

      const result = await readTsconfig(dir);
      expect(result.paths).toBeUndefined();
      expect(result.baseUrl).toBeUndefined();
      expect(result.jsx).toBeUndefined();
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});
