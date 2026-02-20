import { describe, it, expect } from "vitest";
import { buildRepoContext } from "./index.js";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "doxy-build-test-"));
}

describe("buildRepoContext", () => {
  it("builds context from npm project", async () => {
    const dir = await makeTempDir();
    try {
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({
          dependencies: { react: "^18.0.0", "react-dom": "^18.0.0" },
          devDependencies: { typescript: "^5.0.0" },
        }),
      );
      await writeFile(
        join(dir, "package-lock.json"),
        JSON.stringify({
          lockfileVersion: 3,
          packages: {
            "": {},
            "node_modules/react": { version: "18.2.0" },
            "node_modules/react-dom": { version: "18.2.0" },
            "node_modules/typescript": { version: "5.3.3" },
          },
        }),
      );

      const ctx = await buildRepoContext(dir);

      expect(ctx.root).toBe(resolve(dir));
      expect(ctx.packageManager).toBe("npm");
      expect(ctx.dependencies["react"]).toEqual({
        resolvedVersion: "18.2.0",
        declaredRange: "^18.0.0",
      });
      expect(ctx.dependencies["typescript"]).toEqual({
        resolvedVersion: "5.3.3",
        declaredRange: "^5.0.0",
      });
      expect(ctx.frameworks).toHaveLength(1);
      expect(ctx.frameworks[0]!.id).toBe("react");
      expect(ctx.frameworks[0]!.version).toBe("18.2.0");
      expect(ctx.contextHash).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("builds context from yarn project", async () => {
    const dir = await makeTempDir();
    try {
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({
          dependencies: { react: "^18.0.0" },
        }),
      );
      await writeFile(
        join(dir, "yarn.lock"),
        `# yarn lockfile v1

react@^18.0.0:
  version "18.2.0"
  resolved "https://registry.yarnpkg.com/react/-/react-18.2.0.tgz"
`,
      );

      const ctx = await buildRepoContext(dir);
      expect(ctx.packageManager).toBe("yarn");
      expect(ctx.dependencies["react"]!.resolvedVersion).toBe("18.2.0");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("builds context from pnpm project", async () => {
    const dir = await makeTempDir();
    try {
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({
          dependencies: { react: "^18.0.0" },
        }),
      );
      await writeFile(
        join(dir, "pnpm-lock.yaml"),
        `lockfileVersion: '6.0'

dependencies:
  react: 18.2.0
`,
      );

      const ctx = await buildRepoContext(dir);
      expect(ctx.packageManager).toBe("pnpm");
      expect(ctx.dependencies["react"]!.resolvedVersion).toBe("18.2.0");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("works without a lockfile (falls back to npm, no resolved versions)", async () => {
    const dir = await makeTempDir();
    try {
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({
          dependencies: { react: "^18.0.0" },
        }),
      );

      const ctx = await buildRepoContext(dir);
      expect(ctx.packageManager).toBe("npm");
      expect(ctx.dependencies["react"]!.resolvedVersion).toBeUndefined();
      expect(ctx.dependencies["react"]!.declaredRange).toBe("^18.0.0");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("reads tsconfig paths", async () => {
    const dir = await makeTempDir();
    try {
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({ dependencies: {} }),
      );
      await writeFile(
        join(dir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            paths: { "@/*": ["./src/*"] },
            jsx: "react-jsx",
          },
        }),
      );

      const ctx = await buildRepoContext(dir);
      expect(ctx.tsconfig.paths).toEqual({ "@/*": ["./src/*"] });
      expect(ctx.tsconfig.jsx).toBe("react-jsx");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("detects both Next.js and React", async () => {
    const dir = await makeTempDir();
    try {
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({
          dependencies: {
            next: "^14.0.0",
            react: "^18.0.0",
            "react-dom": "^18.0.0",
          },
        }),
      );
      await writeFile(
        join(dir, "package-lock.json"),
        JSON.stringify({
          lockfileVersion: 3,
          packages: {
            "": {},
            "node_modules/next": { version: "14.2.0" },
            "node_modules/react": { version: "18.2.0" },
            "node_modules/react-dom": { version: "18.2.0" },
          },
        }),
      );

      const ctx = await buildRepoContext(dir);
      expect(ctx.frameworks).toHaveLength(2);
      const nextjs = ctx.frameworks.find((f) => f.id === "nextjs");
      const react = ctx.frameworks.find((f) => f.id === "react");
      expect(nextjs!.version).toBe("14.2.0");
      expect(react!.version).toBe("18.2.0");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("applies framework config overrides", async () => {
    const dir = await makeTempDir();
    try {
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({
          dependencies: { react: "^18.0.0" },
        }),
      );
      await writeFile(
        join(dir, "package-lock.json"),
        JSON.stringify({
          lockfileVersion: 3,
          packages: {
            "": {},
            "node_modules/react": { version: "18.2.0" },
          },
        }),
      );

      const ctx = await buildRepoContext(dir, {
        frameworks: { react: "19.0.0" },
      });
      expect(ctx.frameworks[0]!.version).toBe("19.0.0");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("produces consistent context hash", async () => {
    const dir = await makeTempDir();
    try {
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({ dependencies: { react: "^18.0.0" } }),
      );

      const ctx1 = await buildRepoContext(dir);
      const ctx2 = await buildRepoContext(dir);
      expect(ctx1.contextHash).toBe(ctx2.contextHash);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});
