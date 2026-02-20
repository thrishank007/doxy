import { describe, it, expect } from "vitest";
import {
  parseNpmLockfile,
  parsePnpmLockfile,
  parseYarnLockfile,
} from "./lockfile.js";

// ─── npm lockfile ────────────────────────────────────────────────

describe("parseNpmLockfile", () => {
  it("parses v2/v3 packages format", () => {
    const lockfile = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": { name: "my-app", version: "1.0.0" },
        "node_modules/react": { version: "18.2.0" },
        "node_modules/react-dom": { version: "18.2.0" },
        "node_modules/typescript": { version: "5.3.3" },
      },
    });

    const versions = parseNpmLockfile(lockfile);
    expect(versions["react"]).toBe("18.2.0");
    expect(versions["react-dom"]).toBe("18.2.0");
    expect(versions["typescript"]).toBe("5.3.3");
  });

  it("handles scoped packages", () => {
    const lockfile = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": {},
        "node_modules/@tanstack/react-query": { version: "5.17.0" },
        "node_modules/@types/node": { version: "22.1.0" },
      },
    });

    const versions = parseNpmLockfile(lockfile);
    expect(versions["@tanstack/react-query"]).toBe("5.17.0");
    expect(versions["@types/node"]).toBe("22.1.0");
  });

  it("skips root entry (empty key)", () => {
    const lockfile = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": { name: "my-app", version: "1.0.0" },
        "node_modules/react": { version: "18.2.0" },
      },
    });

    const versions = parseNpmLockfile(lockfile);
    expect(versions[""]).toBeUndefined();
    expect(versions["my-app"]).toBeUndefined();
    expect(versions["react"]).toBe("18.2.0");
  });

  it("prefers top-level over nested node_modules", () => {
    const lockfile = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": {},
        "node_modules/react": { version: "18.2.0" },
        "node_modules/some-lib/node_modules/react": { version: "17.0.2" },
      },
    });

    const versions = parseNpmLockfile(lockfile);
    // First encountered wins
    expect(versions["react"]).toBe("18.2.0");
  });

  it("falls back to v1 dependencies format", () => {
    const lockfile = JSON.stringify({
      lockfileVersion: 1,
      dependencies: {
        react: { version: "18.2.0" },
        "react-dom": { version: "18.2.0" },
      },
    });

    const versions = parseNpmLockfile(lockfile);
    expect(versions["react"]).toBe("18.2.0");
    expect(versions["react-dom"]).toBe("18.2.0");
  });

  it("handles empty lockfile", () => {
    const lockfile = JSON.stringify({ lockfileVersion: 3 });
    const versions = parseNpmLockfile(lockfile);
    expect(Object.keys(versions)).toHaveLength(0);
  });

  it("skips entries without version", () => {
    const lockfile = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": {},
        "node_modules/react": { version: "18.2.0" },
        "node_modules/broken": {},
      },
    });

    const versions = parseNpmLockfile(lockfile);
    expect(versions["react"]).toBe("18.2.0");
    expect(versions["broken"]).toBeUndefined();
  });
});

// ─── pnpm lockfile ───────────────────────────────────────────────

describe("parsePnpmLockfile", () => {
  it("parses top-level dependencies format", () => {
    const lockfile = `lockfileVersion: '6.0'

dependencies:
  react: 18.2.0
  react-dom: 18.2.0

devDependencies:
  typescript: 5.3.3
`;

    const versions = parsePnpmLockfile(lockfile);
    expect(versions["react"]).toBe("18.2.0");
    expect(versions["react-dom"]).toBe("18.2.0");
    expect(versions["typescript"]).toBe("5.3.3");
  });

  it("parses packages section (v6+ format)", () => {
    const lockfile = `lockfileVersion: '6.0'

packages:
  /react@18.2.0:
    resolution: {integrity: sha512-xxx}
  /@tanstack/react-query@5.17.0:
    resolution: {integrity: sha512-yyy}
`;

    const versions = parsePnpmLockfile(lockfile);
    expect(versions["react"]).toBe("18.2.0");
    expect(versions["@tanstack/react-query"]).toBe("5.17.0");
  });

  it("parses packages section (v9 format without leading /)", () => {
    const lockfile = `lockfileVersion: '9.0'

packages:
  react@18.2.0:
    resolution: {integrity: sha512-xxx}
  '@tanstack/react-query@5.17.0':
    resolution: {integrity: sha512-yyy}
`;

    const versions = parsePnpmLockfile(lockfile);
    expect(versions["react"]).toBe("18.2.0");
    expect(versions["@tanstack/react-query"]).toBe("5.17.0");
  });

  it("strips peer dependency suffixes from versions", () => {
    const lockfile = `lockfileVersion: '6.0'

packages:
  /react-dom@18.2.0(react@18.2.0):
    resolution: {integrity: sha512-xxx}
`;

    const versions = parsePnpmLockfile(lockfile);
    expect(versions["react-dom"]).toBe("18.2.0");
  });

  it("parses importers section (monorepo root)", () => {
    const lockfile = `lockfileVersion: '9.0'

importers:
  .:
    dependencies:
      react:
        specifier: ^18.2.0
        version: 18.2.0
      next:
        specifier: ^14.0.0
        version: 14.2.0
`;

    const versions = parsePnpmLockfile(lockfile);
    expect(versions["react"]).toBe("18.2.0");
    expect(versions["next"]).toBe("14.2.0");
  });

  it("handles empty lockfile", () => {
    const versions = parsePnpmLockfile("lockfileVersion: '6.0'\n");
    expect(Object.keys(versions)).toHaveLength(0);
  });
});

// ─── yarn lockfile ───────────────────────────────────────────────

describe("parseYarnLockfile", () => {
  it("parses basic yarn.lock format", () => {
    const lockfile = `# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
# yarn lockfile v1

react@^18.0.0:
  version "18.2.0"
  resolved "https://registry.yarnpkg.com/react/-/react-18.2.0.tgz"

react-dom@^18.0.0:
  version "18.2.0"
  resolved "https://registry.yarnpkg.com/react-dom/-/react-dom-18.2.0.tgz"
`;

    const versions = parseYarnLockfile(lockfile);
    expect(versions["react"]).toBe("18.2.0");
    expect(versions["react-dom"]).toBe("18.2.0");
  });

  it("handles scoped packages", () => {
    const lockfile = `"@tanstack/react-query@^5.0.0":
  version "5.17.0"
  resolved "https://registry.yarnpkg.com/@tanstack/react-query/-/react-query-5.17.0.tgz"

"@types/node@^22.0.0":
  version "22.1.0"
  resolved "https://registry.yarnpkg.com/@types/node/-/node-22.1.0.tgz"
`;

    const versions = parseYarnLockfile(lockfile);
    expect(versions["@tanstack/react-query"]).toBe("5.17.0");
    expect(versions["@types/node"]).toBe("22.1.0");
  });

  it("handles multi-version entries", () => {
    const lockfile = `react@^18.0.0, react@^18.2.0:
  version "18.2.0"
  resolved "https://registry.yarnpkg.com/react/-/react-18.2.0.tgz"
`;

    const versions = parseYarnLockfile(lockfile);
    expect(versions["react"]).toBe("18.2.0");
  });

  it("handles quoted entry headers", () => {
    const lockfile = `"react@^18.0.0":
  version "18.2.0"
  resolved "https://registry.yarnpkg.com/react/-/react-18.2.0.tgz"
`;

    const versions = parseYarnLockfile(lockfile);
    expect(versions["react"]).toBe("18.2.0");
  });

  it("handles empty lockfile", () => {
    const lockfile = `# yarn lockfile v1

`;

    const versions = parseYarnLockfile(lockfile);
    expect(Object.keys(versions)).toHaveLength(0);
  });

  it("first version wins for duplicate packages", () => {
    const lockfile = `react@^17.0.0:
  version "17.0.2"
  resolved "https://registry.yarnpkg.com/react/-/react-17.0.2.tgz"

react@^18.0.0:
  version "18.2.0"
  resolved "https://registry.yarnpkg.com/react/-/react-18.2.0.tgz"
`;

    const versions = parseYarnLockfile(lockfile);
    // First encountered wins
    expect(versions["react"]).toBe("17.0.2");
  });
});
