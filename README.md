<p align="center">
  <h1 align="center">doxy</h1>
  <p align="center">
    Static API compatibility verifier for JavaScript & TypeScript
    <br />
    <strong>Catch deprecated, removed, and future APIs at lint time — before they break at runtime.</strong>
  </p>
</p>

<p align="center">
  <a href="#installation">Installation</a> &nbsp;&bull;&nbsp;
  <a href="#quick-start">Quick Start</a> &nbsp;&bull;&nbsp;
  <a href="#cli-reference">CLI Reference</a> &nbsp;&bull;&nbsp;
  <a href="#configuration">Configuration</a> &nbsp;&bull;&nbsp;
  <a href="#how-it-works">How It Works</a>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg" />
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" />
  <img alt="TypeScript" src="https://img.shields.io/badge/typescript-5.7-blue.svg" />
  <img alt="Status" src="https://img.shields.io/badge/status-alpha-orange.svg" />
</p>

---

Think of doxy as **"caniuse for npm packages"** — it reads your lockfile versions and curated API data to find mismatches at lint time, with zero runtime cost.

```
$ doxy verify

  src/App.tsx
    5:17  warning  react.createFactory is deprecated since 16.13.0.     deprecated-api  dxy_a1b2c3d4
                   Use React.createElement or JSX instead.
   11:18  warning  react-dom.findDOMNode is deprecated since 16.6.0.    deprecated-api  dxy_e5f6a7b8
                   Use refs instead.

  src/Dashboard.tsx
    3:14  error    react.useId is not available in 17.0.2.              future-api      dxy_c9d0e1f2
                   It was added in 18.0.0.

  3 findings (1 error, 2 warnings)
```

## Why doxy?

| Problem | Without doxy | With doxy |
|---|---|---|
| Using a deprecated API | Discover at code review (maybe) | Caught at lint time |
| Calling a removed API after upgrade | Runtime crash in production | Caught before deploy |
| Using an API from a newer version | `undefined is not a function` | Clear error with version info |
| Wrong number of arguments | Subtle bugs, silent failures | Caught with expected arity |

## Features

- **Deprecated API detection** — warns when you use APIs deprecated in your installed version
- **Removed API detection** — errors when you use APIs removed in your installed version
- **Future API detection** — errors when you use APIs that require a newer version than installed
- **Wrong arity detection** — errors when you call functions with the wrong number of arguments
- **Incremental analysis** — only re-analyzes changed files using git diff + content hashing
- **Inline suppression** — silence specific findings with `// doxy-ignore` comments
- **Config-level suppression** — suppress patterns project-wide with glob-based rules
- **Multiple output formats** — human-readable, JSON, JSONL, SARIF
- **Framework-aware** — understands React/Next.js import patterns and re-exports
- **Fast** — powered by SWC for parsing (~100x faster than TypeScript compiler)

## Installation

```bash
npm install --save-dev doxy
```

```bash
pnpm add -D doxy
```

```bash
yarn add -D doxy
```

> **Requirements:** Node.js >= 18

## Quick Start

```bash
# Run verification on your project
npx doxy verify

# Only check changed files (great for CI)
npx doxy verify --changed

# Output as JSON for tooling integration
npx doxy verify --json

# Get detailed info about a specific finding
npx doxy explain dxy_a1b2c3d4
```

## CLI Reference

### Commands

| Command | Description |
|---|---|
| `doxy verify [files...]` | Run verification (default command) |
| `doxy init` | Initialize doxy in your project |
| `doxy explain <finding-id>` | Detailed explanation of a finding |
| `doxy cache status` | Show cache statistics |
| `doxy cache clear` | Delete cached data |
| `doxy authority list` | List loaded authority packages |
| `doxy authority update` | Pull latest authority data |
| `doxy authority show <pkg> [export]` | Inspect authority data for a package |
| `doxy fix [files...]` | Apply auto-fixes |

### Verify Flags

| Flag | Description |
|---|---|
| `--json` | Output findings as JSON |
| `--jsonl` | Output findings as newline-delimited JSON |
| `--sarif` | Output findings in SARIF format |
| `--severity <level>` | Minimum severity to report (default: `warning`) |
| `--fail-on <level>` | Exit non-zero threshold (default: `error`) |
| `--changed` | Only analyze changed files |
| `--base <ref>` | Git ref for diff base |
| `--no-cache` | Disable caching |
| `--framework <name@version>` | Override framework detection |
| `--save-baseline` | Save current findings as baseline |
| `--update-baseline` | Update baseline to current findings |
| `--include-baseline` | Show baseline findings in output |
| `--include-suppressed` | Show suppressed findings in output |

### Exit Codes

| Code | Meaning |
|---|---|
| `0` | No findings at or above `--fail-on` severity |
| `1` | Findings exist at or above `--fail-on` severity |
| `2` | Configuration error |
| `3` | Project error (can't read project) |
| `4` | Authority data error |
| `5` | Internal error |

## Configuration

Create a `doxy.config.json` in your project root:

```json
{
  "include": ["src/**/*.{ts,tsx,js,jsx}"],
  "exclude": ["**/*.test.*", "**/*.spec.*"],
  "severity": "warning",
  "failOn": "error",
  "frameworks": {},
  "pathAliases": {},
  "suppressions": [],
  "requireSuppressionReason": false,
  "authorityDataSources": ["builtin"]
}
```

### Suppression Rules

Suppress findings project-wide using config rules:

```json
{
  "suppressions": [
    {
      "paths": ["src/legacy/**"],
      "kind": "deprecated-api",
      "reason": "Legacy module — migrating to new APIs in Q2"
    },
    {
      "package": "react",
      "export": "findDOMNode",
      "kind": "*",
      "reason": "Used in legacy adapter, isolated and tested"
    }
  ]
}
```

### Inline Suppression

Suppress individual findings directly in code:

```tsx
// Suppress the next line
// doxy-ignore deprecated-api -- Legacy compat layer
const factory = createFactory("div");

// Suppress current line
const node = findDOMNode(this); // doxy-ignore-line deprecated-api

// Suppress a block
/* doxy-ignore-start deprecated-api -- Entire legacy section */
const a = createFactory("div");
const b = createFactory("span");
/* doxy-ignore-end */
```

## How It Works

```
Source files ─┐
              ├─► SWC Parser ─► Import Resolver ─► Authority Store Query ─► Findings
Lockfile ─────┘       │              │                      │
                      │              │                      │
                 Normalized AST   SymbolUsage[]     Version-aware lookup
                                                    (deprecated? removed?
                                                     future? wrong arity?)
```

1. **Parse** — SWC parses your source files into a normalized AST
2. **Resolve** — Import resolver maps `import` statements to package/export pairs
3. **Query** — Each symbol is checked against curated authority data for your installed version
4. **Emit** — Findings are generated with severity, messages, and fix suggestions
5. **Filter** — Inline and config-level suppressions are applied
6. **Cache** — Results are cached per-file with smart invalidation

doxy never executes your code. It reads your lockfile for installed versions and uses curated API specifications to detect issues statically.

## Supported Frameworks

| Framework | Status | Packages |
|---|---|---|
| React | Supported | `react`, `react-dom` |
| Next.js | Planned | `next` |

Authority data currently covers **27 API specs** across React and ReactDOM, including hooks, lifecycle methods, rendering APIs, and more.

## Finding Kinds

| Kind | Severity | Description |
|---|---|---|
| `deprecated-api` | warning | API is deprecated in your installed version |
| `removed-api` | error | API was removed in your installed version |
| `future-api` | error | API requires a newer version than installed |
| `wrong-arity` | error | Function called with wrong number of arguments |
| `wrong-param` | error | Function called with wrong parameter names |
| `unknown-export` | info | Export not found in authority data |

## CI Integration

```yaml
# GitHub Actions
- name: Check API compatibility
  run: npx doxy verify --fail-on error
```

```yaml
# With JSON output for annotations
- name: Check API compatibility
  run: npx doxy verify --json > doxy-results.json
```

doxy writes **findings to stdout** and **everything else to stderr**, making it easy to pipe and parse output in CI pipelines.

## Contributing

Contributions are welcome! Here's how to get started:

```bash
git clone https://github.com/your-username/doxy.git
cd doxy
npm install
npm run check    # typecheck + lint + test
```

### Project Structure

```
doxy/
├── src/
│   ├── cli/                 CLI entry point + commands
│   ├── core/                Pure analysis logic
│   │   ├── types/           All shared type definitions
│   │   ├── repo-context/    Version detection from manifests
│   │   ├── import-resolver/ Import → package/export mapping
│   │   ├── suppression/     Inline + config suppression
│   │   └── analyzer/        Per-file analysis orchestration
│   ├── authority/           Authority data store
│   ├── adapters/            Framework-specific adapters
│   ├── parser/              SWC-based AST parsing
│   └── incremental/         Git diff + caching
├── authority-data/          Curated API spec datasets
└── fixtures/                Test fixture mini-projects
```

### Running Tests

```bash
npm test              # run all tests
npm run test:watch    # watch mode
npm run typecheck     # type check only
npm run lint          # lint only
npm run check         # all of the above
```

## License

[MIT](./LICENSE)
