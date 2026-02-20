import { describe, it, expect } from "vitest";
import {
  loadBuiltinAuthority,
  loadAuthorityFromDir,
  createAuthorityStoreFromSpecs,
} from "./store.js";
import { resolve } from "node:path";
import type { ApiSpec } from "../core/types/index.js";

const AUTHORITY_DIR = resolve(import.meta.dirname, "../../authority-data");

// ─── Loading ─────────────────────────────────────────────────────

describe("loadAuthorityFromDir", () => {
  it("loads builtin authority data", async () => {
    const store = await loadAuthorityFromDir(AUTHORITY_DIR);
    expect(store.dataVersion()).toBe("0.1.0");
    expect(store.coveredPackages()).toContain("react");
    expect(store.coveredPackages()).toContain("react-dom");
  });

  it("produces a valid content hash", async () => {
    const store = await loadAuthorityFromDir(AUTHORITY_DIR);
    expect(store.contentHash()).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces deterministic hash", async () => {
    const store1 = await loadAuthorityFromDir(AUTHORITY_DIR);
    const store2 = await loadAuthorityFromDir(AUTHORITY_DIR);
    expect(store1.contentHash()).toBe(store2.contentHash());
  });

  it("hasPackage returns true for covered packages", async () => {
    const store = await loadAuthorityFromDir(AUTHORITY_DIR);
    expect(store.hasPackage("react")).toBe(true);
    expect(store.hasPackage("react-dom")).toBe(true);
    expect(store.hasPackage("vue")).toBe(false);
  });
});

describe("loadBuiltinAuthority", () => {
  it("loads without errors", async () => {
    const store = await loadBuiltinAuthority();
    expect(store.coveredPackages().length).toBeGreaterThan(0);
  });
});

// ─── Query: available APIs ───────────────────────────────────────

describe("getApiSpec — available APIs", () => {
  it("finds useState in React 18", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react", "useState", "18.2.0");
    expect(result).toBeDefined();
    expect(result!.available).toBe(true);
    expect(result!.isFuture).toBe(false);
    expect(result!.activeSignature).toBeDefined();
    expect(result!.activeSignature!.minArity).toBe(0);
    expect(result!.activeSignature!.maxArity).toBe(1);
    expect(result!.activeDeprecation).toBeUndefined();
  });

  it("finds useEffect with correct arity", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react", "useEffect", "18.2.0");
    expect(result).toBeDefined();
    expect(result!.activeSignature!.minArity).toBe(1);
    expect(result!.activeSignature!.maxArity).toBe(2);
  });

  it("finds useReducer with correct arity", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react", "useReducer", "18.2.0");
    expect(result).toBeDefined();
    expect(result!.activeSignature!.minArity).toBe(2);
    expect(result!.activeSignature!.maxArity).toBe(3);
  });

  it("finds createRoot in react-dom 18", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react-dom", "createRoot", "18.2.0");
    expect(result).toBeDefined();
    expect(result!.available).toBe(true);
    expect(result!.isFuture).toBe(false);
  });

  it("returns undefined for unknown export", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react", "doesNotExist", "18.2.0");
    expect(result).toBeUndefined();
  });

  it("returns undefined for unknown package", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("vue", "ref", "3.0.0");
    expect(result).toBeUndefined();
  });
});

// ─── Query: deprecated APIs ──────────────────────────────────────

describe("getApiSpec — deprecated APIs", () => {
  it("detects createFactory as deprecated in React 18", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react", "createFactory", "18.2.0");
    expect(result).toBeDefined();
    expect(result!.available).toBe(true);
    expect(result!.activeDeprecation).toBeDefined();
    expect(result!.activeDeprecation!.since).toBe("16.13.0");
    expect(result!.activeDeprecation!.removedIn).toBe("19.0.0");
    expect(result!.activeDeprecation!.replacement).toBeDefined();
    expect(result!.activeDeprecation!.replacement!.export).toBe("createElement");
  });

  it("detects findDOMNode as deprecated in React 18", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react-dom", "findDOMNode", "18.2.0");
    expect(result).toBeDefined();
    expect(result!.available).toBe(true);
    expect(result!.activeDeprecation).toBeDefined();
    expect(result!.activeDeprecation!.since).toBe("16.6.0");
  });

  it("detects ReactDOM.render as deprecated in React 18", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react-dom", "render", "18.2.0");
    expect(result).toBeDefined();
    expect(result!.available).toBe(true);
    expect(result!.activeDeprecation).toBeDefined();
    expect(result!.activeDeprecation!.since).toBe("18.0.0");
    expect(result!.activeDeprecation!.removedIn).toBe("19.0.0");
  });

  it("no deprecation for createFactory in React 16.12 (before deprecation)", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react", "createFactory", "16.12.0");
    expect(result).toBeDefined();
    expect(result!.available).toBe(true);
    expect(result!.activeDeprecation).toBeUndefined();
  });

  it("detects forwardRef as deprecated in React 19", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react", "forwardRef", "19.0.0");
    expect(result).toBeDefined();
    expect(result!.available).toBe(true);
    expect(result!.activeDeprecation).toBeDefined();
    expect(result!.activeDeprecation!.since).toBe("19.0.0");
  });
});

// ─── Query: removed APIs ─────────────────────────────────────────

describe("getApiSpec — removed APIs", () => {
  it("detects createFactory as removed in React 19", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react", "createFactory", "19.0.0");
    expect(result).toBeDefined();
    expect(result!.available).toBe(false);
    expect(result!.isFuture).toBe(false);
    // The deprecation with removedIn is still returned for context
    expect(result!.activeDeprecation).toBeDefined();
    expect(result!.activeDeprecation!.removedIn).toBe("19.0.0");
  });

  it("detects findDOMNode as removed in React 19", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react-dom", "findDOMNode", "19.0.0");
    expect(result).toBeDefined();
    expect(result!.available).toBe(false);
    expect(result!.isFuture).toBe(false);
  });

  it("detects ReactDOM.render as removed in React 19", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react-dom", "render", "19.0.0");
    expect(result).toBeDefined();
    expect(result!.available).toBe(false);
  });

  it("detects unmountComponentAtNode as removed in React 19", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react-dom", "unmountComponentAtNode", "19.0.0");
    expect(result).toBeDefined();
    expect(result!.available).toBe(false);
  });
});

// ─── Query: future APIs ──────────────────────────────────────────

describe("getApiSpec — future APIs", () => {
  it("detects useId as future in React 17", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react", "useId", "17.0.2");
    expect(result).toBeDefined();
    expect(result!.available).toBe(false);
    expect(result!.isFuture).toBe(true);
  });

  it("detects useTransition as future in React 17", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react", "useTransition", "17.0.2");
    expect(result).toBeDefined();
    expect(result!.available).toBe(false);
    expect(result!.isFuture).toBe(true);
  });

  it("detects createRoot as future in React 17", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react-dom", "createRoot", "17.0.2");
    expect(result).toBeDefined();
    expect(result!.available).toBe(false);
    expect(result!.isFuture).toBe(true);
  });

  it("detects use() hook as future in React 18", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react", "use", "18.2.0");
    expect(result).toBeDefined();
    expect(result!.available).toBe(false);
    expect(result!.isFuture).toBe(true);
  });

  it("detects use() hook as available in React 19", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react", "use", "19.0.0");
    expect(result).toBeDefined();
    expect(result!.available).toBe(true);
    expect(result!.isFuture).toBe(false);
  });
});

// ─── Query: signature versioning ─────────────────────────────────

describe("getApiSpec — versioned signatures", () => {
  it("useDeferredValue has 1-arg signature in React 18", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react", "useDeferredValue", "18.2.0");
    expect(result).toBeDefined();
    expect(result!.activeSignature).toBeDefined();
    expect(result!.activeSignature!.maxArity).toBe(1);
  });

  it("useDeferredValue has 1-2 arg signature in React 19", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react", "useDeferredValue", "19.0.0");
    expect(result).toBeDefined();
    expect(result!.activeSignature).toBeDefined();
    expect(result!.activeSignature!.minArity).toBe(1);
    expect(result!.activeSignature!.maxArity).toBe(2);
  });

  it("removed API has no active signature at removal version", async () => {
    const store = await loadBuiltinAuthority();
    const result = store.getApiSpec("react", "createFactory", "19.0.0");
    expect(result).toBeDefined();
    // Signature has until: "19.0.0", so not active at 19.0.0
    expect(result!.activeSignature).toBeUndefined();
  });
});

// ─── createAuthorityStoreFromSpecs ───────────────────────────────

describe("createAuthorityStoreFromSpecs", () => {
  it("creates a store from inline specs", () => {
    const specs: ApiSpec[] = [
      {
        package: "test-pkg",
        export: "testFn",
        kind: "function",
        availableIn: ">=1.0.0",
        signatures: [
          { since: "1.0.0", minArity: 1, maxArity: 2, params: [] },
        ],
        deprecations: [],
      },
    ];

    const store = createAuthorityStoreFromSpecs(specs);
    expect(store.hasPackage("test-pkg")).toBe(true);
    expect(store.coveredPackages()).toEqual(["test-pkg"]);

    const result = store.getApiSpec("test-pkg", "testFn", "1.5.0");
    expect(result).toBeDefined();
    expect(result!.available).toBe(true);
    expect(result!.activeSignature!.minArity).toBe(1);
  });

  it("uses provided version string", () => {
    const store = createAuthorityStoreFromSpecs([], "1.2.3");
    expect(store.dataVersion()).toBe("1.2.3");
  });

  it("defaults to test version", () => {
    const store = createAuthorityStoreFromSpecs([]);
    expect(store.dataVersion()).toBe("0.0.0-test");
  });
});

// ─── Authority data validation ───────────────────────────────────

describe("builtin authority data integrity", () => {
  it("all specs have required fields", async () => {
    const store = await loadBuiltinAuthority();
    // If loading succeeded without Zod errors, all specs are valid
    expect(store.coveredPackages().length).toBeGreaterThan(0);
  });

  it("react package has at least 15 exports", async () => {
    const store = await loadBuiltinAuthority();
    // Count specs for react by querying known exports
    const knownReactExports = [
      "useState", "useEffect", "useCallback", "useMemo", "useRef",
      "useReducer", "useContext", "useId", "useTransition", "useDeferredValue",
      "createContext", "createElement", "createFactory", "createRef",
      "forwardRef", "memo", "lazy", "PropTypes", "useInsertionEffect", "use",
    ];
    let found = 0;
    for (const exp of knownReactExports) {
      if (store.getApiSpec("react", exp, "18.2.0") !== undefined) {
        found++;
      }
    }
    expect(found).toBeGreaterThanOrEqual(15);
  });

  it("react-dom package has at least 5 exports", async () => {
    const store = await loadBuiltinAuthority();
    const knownExports = [
      "createRoot", "hydrateRoot", "render", "hydrate",
      "findDOMNode", "unmountComponentAtNode", "flushSync",
    ];
    let found = 0;
    for (const exp of knownExports) {
      if (store.getApiSpec("react-dom", exp, "18.2.0") !== undefined) {
        found++;
      }
    }
    expect(found).toBeGreaterThanOrEqual(5);
  });
});
