# Doxy - Static API Compatibility Verifier

## Project Overview

Doxy is a static analysis tool that verifies API compatibility between your code and installed dependency versions. It checks for deprecated APIs, removed APIs, wrong arities, and future-version APIs without running your code.

Think of it as "caniuse for npm packages" — it reads your lockfile versions and authority data to catch mismatches at lint time.

## Architecture

### Data Flow (verify command)

```
1. CLI parses argv + loads config (.doxyrc / doxy.config.json)
2. Repo Context Builder → reads package.json, lockfile, tsconfig → produces RepoContext
3. Authority Store → loads curated API spec data → queryable index
4. Incremental Engine → reads git diff (or file hashes if no git), cache → produces RunPlan
5. Analyzer (parallel per-file) → Parser (SWC) → Import Resolver → Framework Adapter → Checker → Finding[]
6. Apply suppression filters (inline comments + config rules + baseline)
7. Merge fresh findings with valid cached findings
8. GC stale cache entries (deleted/renamed files)
9. Update cache (including per-file package tracking)
10. Output Engine formats findings → stdout; Orchestrator determines exit code
```

### Component Boundaries

| Component | Owns | Does NOT own |
|---|---|---|
| **CLI Interface** | Argv parsing, config loading/merging, output formatting, exit codes, stdout/stderr routing | Business logic, AST parsing, authority data |
| **Orchestrator** | Pipeline sequencing, timing, error aggregation | Any specific analysis logic |
| **Repo Context Builder** | Reading manifests + lockfiles, version resolution, tsconfig parsing, framework detection | Git operations, caching, analysis |
| **Authority Store** | Loading/indexing API spec data, version range queries, content hashing | Source files, parsing code |
| **Incremental Engine** | Git diff computation (with hash-based fallback), cache reads/writes/invalidation, run planning, rename detection | Parsing, validation, authority knowledge |
| **Analyzer** | AST parsing, import resolution, symbol-to-spec matching, suppression comment extraction, finding emission | Storing data, git operations, output formatting |
| **Framework Adapters** | Framework-specific version detection, symbol resolution, re-export mapping | Core pipeline logic, cache management |
| **Cache Layer** | Persistence of per-file results, hash-based validity checks, per-file package tracking, GC of stale entries | Deciding what to analyze |

### Module Structure

```
doxy/
├── src/
│   ├── cli/                    CLI entry point + subcommand handlers
│   │   ├── commands/           One file per subcommand
│   │   ├── config              Config file discovery + merging
│   │   └── output              Formatters (human, json, jsonl, sarif)
│   │
│   ├── core/                   Pure logic, zero I/O assumptions
│   │   ├── types               All shared type definitions
│   │   ├── repo-context        Version detection from manifests
│   │   ├── analyzer            Per-file analysis orchestration
│   │   ├── import-resolver     import/require → package + export mapping
│   │   ├── signature-checker   Arity + param name verification
│   │   ├── suppression         Inline comment parsing + config rule matching
│   │   └── pipeline            Top-level orchestration of all steps
│   │
│   ├── authority/              Authority store logic
│   │   ├── store               Load, index, query
│   │   ├── schema              Authority data validation
│   │   └── updater             Fetch/update datasets
│   │
│   ├── incremental/            Git diff + caching
│   │   ├── git                 Git operations wrapper (with no-git fallback)
│   │   ├── cache               Read/write/invalidate cache + GC
│   │   └── planner             Compute RunPlan from diffs + cache state + renames
│   │
│   ├── adapters/               Framework adapters
│   │   ├── interface           FrameworkAdapter contract definition
│   │   ├── react               React-specific adapter
│   │   ├── nextjs              Next.js-specific adapter
│   │   └── registry            Auto-detect + load adapters
│   │
│   └── parser/                 AST parsing abstraction
│       ├── interface           LanguageParser contract
│       ├── swc-bridge          SWC-specific implementation
│       └── normalized-ast      Minimal normalized AST shape definition
│
├── authority-data/             Curated datasets (ships with package)
│   ├── react/                  Per-major-version JSON files
│   ├── next/
│   └── manifest.json           Index of all datasets + versions
│
└── fixtures/                   Test fixtures (per-scenario mini-projects)
```

## Key Data Contracts

### ApiSpec

Represents one exported symbol from a package:
- Package name, export name
- Kind: function | component | type | constant | class
- Version range in which it exists
- List of signatures, each scoped to a version range (min/max arity, parameter specs)
- Deprecation history: each entry has "since" version, optional "removedIn", message, optional replacement (symbol + migration hint)

### AuthorityStore Interface

Given `(package, exportName, installedVersion)` → returns **ResolvedApiSpec**:
- Raw spec + active signature for that version
- Active deprecation if any
- Whether the API is available at all
- Whether the API is from a future version
- Content hash for cache invalidation

### RepoContext

- Root path, detected package manager (npm/pnpm/yarn)
- Map of all dependencies: exact resolved versions (from lockfiles) + declared ranges (from package.json)
- Detected frameworks with versions and confidence levels (lockfile=exact, manifest=range, inferred=heuristic)
- tsconfig options (paths, baseUrl, jsx)
- SHA-256 hash of all inputs for cache keying

### Finding

- **Long ID** (canonical): `dxy:<package>/<export>:<file>:<line>:<col>` — e.g., `dxy:react/createFactory:src/App.tsx:14:5`
- **Short ID** (display): `dxy_` + first 8 chars of SHA-256 of long ID — e.g., `dxy_a1b2c3d4`
- Both forms accepted by `doxy explain`. JSON/JSONL output includes both `id` (short) and `longId` (long). Human output shows short inline, long with `--verbose`.
- **Kind**: deprecated-api | removed-api | future-api | wrong-arity | wrong-param | unknown-export
- **Severity**: error (removed/future/wrong-arity/wrong-param), warning (deprecated), info (unknown-export)
- Source location, human-readable message
- Symbol info (package, export, installed version)
- Fix suggestions (description, optional text replacement, optional reference URL)
- Authority data reference (data version + spec key)
- **suppressed** (optional): `{ source: "inline" | "config" | "baseline", reason: string }` — present when finding was suppressed; suppressed findings excluded from output by default, included with `--include-suppressed`

### RunPlan

- Files to analyze with reasons (file-changed, file-new, file-renamed, manifest-changed, authority-updated, config-changed, cache-miss)
- Cached files with still-valid findings
- Run mode (full vs incremental), base ref
- **gitAvailable**: boolean — whether git operations are available
- **renames**: `Array<{ from: string, to: string }>` — detected file renames for cache migration
- Stats (total, changed, cached, invalidated)

### FrameworkAdapter Contract

- Declares: unique ID, display name, packages it handles
- `detect(repoCtx)` → presence + version
- `resolveSymbols(imports, normalizedAST)` → SymbolUsage[]
- Optional: `enrichFindings(findings)` → enriched findings

### SymbolUsage

- Package name, export name, import kind (named/default/namespace/dynamic)
- Usage sites: location, observed arg count, observed arg names

### FileCacheEntry (revised)

- `filePath`: relative path (cache key)
- `contentHash`: SHA-256 of file bytes
- `authorityVersion`: authority data version used
- `repoContextHash`: repo context hash used (global fallback)
- `importedPackages`: `string[]` — authority-tracked packages this file imports (for smart invalidation)
- `packageVersions`: `Record<string, string>` — exact resolved versions of imported packages at analysis time
- `findings`: Finding[] from last analysis
- `unresolvedImports`: `string[]` — import specifiers that couldn't be resolved (for new-package detection)
- `analyzedAt`: timestamp (for display, not invalidation)

### SuppressionRule (config-level)

- `package` (optional): scope to a specific package
- `export` (optional): scope to a specific export
- `kind` (optional, default `"*"`): violation kind or `"*"` for all
- `paths` (optional): glob patterns for file paths
- `reason` (required): why this suppression exists

### Baseline

- `.doxy/baseline.json` — array of finding long IDs from a baseline run
- Created with `doxy verify --save-baseline`
- Updated with `doxy verify --update-baseline`
- Findings matching baseline IDs don't affect exit code, shown with `[baseline]` tag in human output

## CLI Design

### Subcommands

| Command | Purpose |
|---|---|
| `doxy verify [files...]` | Run verification (default subcommand) |
| `doxy init` | Initialize doxy in project |
| `doxy explain <finding-id>` | Detailed explanation of a finding (reconstructs on demand, no cache dependency) |
| `doxy cache status` | Cache stats |
| `doxy cache clear` | Delete cached data |
| `doxy authority list` | List loaded authority packages |
| `doxy authority update` | Pull latest authority data |
| `doxy authority show <pkg> [export]` | Inspect authority data |
| `doxy fix [files...]` | Apply auto-fixes |

### Key Flags (verify)

`--json`, `--jsonl`, `--sarif` (output format), `--severity <level>` (min to report, default: warning), `--changed` (only changed files), `--base <ref>` (diff base), `--no-cache`, `--fail-on <level>` (exit code threshold, default: error), `--framework <name@version>` (override detection), `--save-baseline` (write baseline file), `--update-baseline` (update baseline to current findings), `--include-baseline` (show baseline findings in output), `--include-suppressed` (show suppressed findings)

### Exit Codes

| Code | Meaning |
|---|---|
| 0 | No findings at/above --fail-on severity |
| 1 | Findings exist at/above --fail-on severity |
| 2 | Config error |
| 3 | Project error (can't read project) |
| 4 | Authority data error |
| 5 | Internal error |

### stdout/stderr Convention

**stdout = findings output ONLY.** Everything else (progress, timing, warnings, errors) goes to stderr.

## Explain Command (cache-independent)

`doxy explain` reconstructs findings on demand — it never reads from cache. Flow:

1. **Parse the finding ID** — both long form (`dxy:react/createFactory:src/App.tsx:14:5`) and short form (`dxy_a1b2c3d4`) are accepted
2. **Long form**: directly extract file, package, export, location
3. **Short form**: re-run verify on the project (or scan last JSON output if available) to find the matching finding
4. **Reconstruct**: parse just that file → load repo context → load authority → run analysis → filter to matching finding
5. **Render**: full deprecation/removal timeline, all signatures across versions, migration guide, replacement code, official docs link, authority source + version
6. **If finding not found at location**: report "Finding not found. The code may have changed." and suggest `doxy verify`

Short form collisions (astronomically unlikely at project scale): report all matches, ask user to use long form.

## Import Resolver Scope

### Supported Patterns

1. **Named imports**: `import { useState } from 'react'` → react/useState
2. **Subpath imports**: `import { createRoot } from 'react-dom/client'` → react-dom/createRoot (package = first segment, or first two if scoped)
3. **Scoped packages**: `import { thing } from '@tanstack/react-query'` → @tanstack/react-query/thing
4. **Namespace imports**: `import * as React from 'react'; React.useState()` → react/useState (track namespace binding, resolve member access)
5. **Default imports with member access**: `import React from 'react'; React.createElement()` → react/createElement (adapter handles React default = namespace)
6. **require()**: `const { useState } = require('react')` → react/useState; `const React = require('react'); React.useState()` → same as namespace
7. **Aliased imports**: `import { useState as useMyState } from 'react'; useMyState()` → react/useState (track alias, resolve back)
8. **Re-exports within same package**: `import { useRouter } from 'next/navigation'` → next/useRouter
9. **tsconfig paths**: `@/*` → `./src/*` → resolved to local, skipped

### Explicitly Not Supported (MVP)

- **Dynamic imports with computed specifiers** — non-deterministic, silently skipped
- **Re-exports across user code (barrel files)** — requires cross-file module graph; local path → skipped. Future v2: single-depth re-export tracing
- **Global variables (no import)** — no import to trace; very low impact for modern TS/JS modules
- **Webpack/Vite aliases not in tsconfig** — config `pathAliases` map available as manual override
- **Conditional exports (package.json "exports" field)** — MVP extracts subpath string directly; low impact since export name is the same
- **Type-only imports** — skipped (no runtime usage). Future v2: optionally lint for removed types
- **Dynamic require with variable paths** — same as dynamic imports, skipped

### Edge Cases

- `import React, { useState } from 'react'` — both default and named: produces SymbolUsage for each
- Star re-export (`export * from 'react'`) — not traced through; the re-exporting file is a local import to consumers
- Multiple import statements for same symbol — both produce SymbolUsage, both checked, both emit findings if violating (correct: user should fix both)
- Import then no usage — still triggers deprecation/removal checks on the import itself (importing a removed API causes bundler/runtime errors)
- Side-effect imports (`import 'react-app-polyfill/ie11'`) — no specifiers, nothing to check, skipped

## Incremental Verification

### Changed File Sources (unioned)

1. `git diff --name-only --diff-filter=ACMR <base>..HEAD`
2. `git diff --name-only` (unstaged)
3. `git ls-files --others --exclude-standard` (untracked)

### Git-Free Fallback

When git is not available (CI tarball, zip download, shallow clone without .git):
- Emit warning to stderr: "Git not available. Using hash-based change detection."
- `--changed` and `--base` flags error with: "These flags require a git repository"
- First run: full scan, populate cache with content hashes
- Subsequent runs: hash each source file, compare to cache; matching hashes → cached findings, different hashes → re-analyze
- CI environments without git still benefit from caching if cache is persisted between runs (e.g., via CI cache actions)
- `RunPlan.gitAvailable` tracks this state

### Rename Detection

When git reports renames (`git diff --diff-filter=R --name-only`):
- The planner records `renames: Array<{ from, to }>` in RunPlan
- If old path has a valid cache entry AND content hash of new path matches: **migrate** the cache entry (copy to new key, delete old key), findings updated with new file path → no re-analysis needed
- If content also changed: invalidate and re-analyze the new path
- Old path cache entry always cleaned up

### Cache Validity (ALL must match)

1. File content SHA-256 unchanged
2. Authority data version matches
3. Repo context hash matches (global) OR per-file package versions match (smart invalidation)

### Smart Manifest Change Invalidation (per-file package tracking)

When package.json or lockfile changes, instead of invalidating ALL files:

1. Build new RepoContext (fresh resolved versions)
2. Compute `changedPackages`: for each package where old version != new version, or package added/removed
3. For each cached file entry:
   - If `entry.importedPackages ∩ changedPackages ≠ ∅` → INVALIDATE (reason: manifest-changed)
   - Else → KEEP (file doesn't import any changed packages)
4. New packages added to authority store: invalidate files with unresolved imports (`unresolvedImports` field)
5. Fallback: if cache was written by older doxy without `importedPackages` data → "invalidate all" (backward compat)

### Global Invalidations (any triggers full re-scan)

- Authority store content hash changed (when per-file tracking unavailable)
- Doxy config hash changed
- Doxy major version changed

### Cache GC

Runs at the end of every verify, before writing cache:
- For each entry in cache: if file does not exist on disk → delete entry
- Cost: one stat() per cached file (~2-5ms for 1000 files)
- Handles: renamed files (old path gone), deleted files, files moved outside project, branch switches

## False Positive Suppression

Three mechanisms, layered:

### 1. Inline Comments (per-line/per-block)

```
// doxy-ignore <kind>[ — reason]     → suppresses next line
// doxy-ignore-line <kind>[ — reason] → suppresses current line (end-of-line)
/* doxy-ignore-start <kind>[ — reason] */ ... /* doxy-ignore-end */  → suppresses block
```

`<kind>` values: deprecated-api, removed-api, future-api, wrong-arity, wrong-param, unknown-export.
Reason is freeform text after `—`, `--`, or `:`. Optional unless `requireSuppressionReason: true` in config.

Parser extracts doxy-ignore comments during AST parsing. Analyzer checks if finding location is covered before emitting. Suppressed findings are not emitted (not in output, not cached, don't affect exit code). `--include-suppressed` shows them with `[suppressed]` tag.

### 2. Config-Level Rules (project-wide patterns)

In `doxy.config.json`:
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
      "kind": "removed-api",
      "reason": "Used in legacy adapter, isolated and tested"
    }
  ]
}
```

Applied after finding emission, before output. First matching rule suppresses. Suppressed findings in JSON output have `suppressed: true` + matching rule's reason (for CI suppression trend tracking).

### 3. Baseline File (brownfield adoption)

For adopting doxy on existing codebases with many pre-existing violations:
- `doxy verify --save-baseline` → full scan → writes `.doxy/baseline.json` with all current finding long IDs
- Subsequent runs: findings in baseline are "known" and don't affect exit code
- Shown with `[baseline]` tag in human output, excluded from JSON by default, included with `--include-baseline`
- `doxy verify --update-baseline` → updates baseline to current findings (use after fixing some violations)

Priority: baseline ships in v0.2.0 if time is tight; inline + config suppressions ship in v0.1.0.

## Authority Data Strategy

### MVP: Curated JSON files + in-memory Map

- One JSON file per package per major version (e.g., `authority-data/react/18.x.json`)
- `manifest.json` at root indexes all packages
- Schema version + data version in every file
- Map<string, ApiSpec> keyed by "package/exportName"
- semver library for range matching

### Future: SQLite via `better-sqlite3` when dataset exceeds ~50 packages / 5MB

## Extensibility Points

1. **Framework Adapters**: Implement adapter contract, register in config
2. **Language Parsers**: Implement parser producing normalized AST (MVP: SWC for TS/JS)
3. **Authority Data Sources**: Add JSON files conforming to schema
4. **Output Formats**: Add formatters (SARIF, checkstyle, etc.)

## Config Fields

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

- `pathAliases`: `Record<string, string>` — manual alias mapping for bundler aliases not in tsconfig (e.g., `{ "@components": "./src/components" }`)
- `suppressions`: `SuppressionRule[]` — project-wide suppression rules
- `requireSuppressionReason`: when true, inline `doxy-ignore` comments without a reason are errors

## Dependencies (runtime)

| Dependency | Purpose |
|---|---|
| `@swc/core` | AST parsing (Rust-backed, ~100x faster than ts-morph) |
| `semver` | Version range matching |
| `citty` or `cleye` | CLI argument parsing |
| `simple-git` | Git operations |
| `zod` | Schema validation |

## Testing Strategy

**Golden output tests**: Fixture mini-projects with pinned versions + `expected-findings.json`. Run full pipeline, compare output.

**Fixture categories**: react-18-deprecated, react-19-removed, react-18-wrong-arity, react-future-api, react-clean, nextjs-14-app-router, mixed-clean-and-dirty, suppression-inline, suppression-config

**Unit tests**: Per-module (lockfile parsing, version range queries, import resolver, arity matching, suppression parsing, cache invalidation with per-file tracking, rename detection)

**Integration tests**: Invoke binary, verify stdout + stderr + exit codes. Include: git-free environment, explain with both ID forms

## MVP Execution Plan (2 Weeks)

### Week 1: Foundation + Core Pipeline
- Days 1-2: Scaffolding, core types (including revised Finding with longId, FileCacheEntry with per-file tracking), test harness, golden-output fixtures
- Days 3-4: Repo context builder (lockfile parsing for npm/pnpm/yarn)
- Day 5: Authority store (React 16-19, ~20 high-signal exports)
- Days 6-7: SWC parser, import resolution (full scope per spec above), React adapter, inline suppression comment extraction (+2h)

### Week 2: End-to-End + Incremental + Polish
- Days 8-9: Analyzer + finding emission + suppression filtering
- Day 10: CLI + output engine + config-level suppressions (+2h), explain command (cache-independent reconstruction)
- Days 11-12: Incremental mode + cache with per-file package tracking (+2h) + rename detection (+3h) + git-free fallback + cache GC
- Days 13-14: Polish, Next.js adapter, .doxyignore, benchmarks, README, v0.1.0
- v0.2.0: Baseline feature for brownfield adoption

### Gap Closures Integrated

| Gap | Where Integrated | Impact |
|---|---|---|
| 1. Explain without cache | cli/commands/explain, Finding gains `longId` | 0 extra days (clarification) |
| 2. Per-file package tracking | incremental/cache, incremental/planner, FileCacheEntry revised | +2h on days 11-12 |
| 3. Import resolver scope | core/import-resolver (documented scope + edge cases), config gains `pathAliases` | 0 extra days (spec) |
| 4. Git-free fallback | incremental/git, RunPlan gains `gitAvailable` | 0 extra days (fallback path) |
| 5. Rename handling | incremental/planner, RunPlan gains `renames` + `file-renamed` reason | +3h on days 11-12 |
| 6. Suppression | core/suppression, config schema, core/types gains `suppressed` field | +6h across days 6-7, 10; baseline in v0.2.0 |
