import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const useShell = process.platform === "win32";
let tarballPath;
let tempRoot;

try {
  const packOutput = execFileSync(npmBin, ["pack", "--json"], {
    cwd: root,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "inherit"],
    shell: useShell,
  });
  const [packed] = JSON.parse(packOutput);
  tarballPath = join(root, packed.filename);

  tempRoot = mkdtempSync(join(tmpdir(), "doxy-pack-"));
  const projectRoot = join(tempRoot, "project");
  cpSync(join(root, "fixtures", "react-18-deprecated"), projectRoot, {
    recursive: true,
  });

  writeFileSync(
    join(projectRoot, "package.json"),
    JSON.stringify(
      {
        name: "doxy-packed-smoke",
        private: true,
        dependencies: {
          react: "18.2.0",
          "react-dom": "18.2.0",
        },
      },
      null,
      2,
    ),
  );

  execFileSync(
    npmBin,
    [
      "install",
      tarballPath,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
    ],
    {
      cwd: projectRoot,
      stdio: "inherit",
      shell: useShell,
    },
  );

  const binName = process.platform === "win32" ? "doxy.cmd" : "doxy";
  const stdout = execFileSync(
    join(projectRoot, "node_modules", ".bin", binName),
    ["verify", "src/App.tsx", "--json", "--fail-on", "error"],
    {
      cwd: projectRoot,
      encoding: "utf-8",
      shell: useShell,
    },
  );
  const result = JSON.parse(stdout);

  if (result.summary?.total !== 2) {
    throw new Error(
      `Expected packed CLI to report 2 findings, got ${result.summary?.total ?? "unknown"}.`,
    );
  }

  process.stdout.write(
    `Packed CLI smoke passed with ${result.summary.total} findings from ${basename(tarballPath)}.\n`,
  );
} finally {
  if (tarballPath) {
    rmSync(tarballPath, { force: true });
  }
  if (tempRoot) {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}
