/**
 * Zod schemas for runtime validation of external data:
 * authority JSON files, config files, cache files.
 */
import { z } from "zod";

// ─── Authority Data Schemas ───────────────────────────────────────

export const ParameterSpecSchema = z.object({
  name: z.string(),
  required: z.boolean(),
  description: z.string().optional(),
});

export const SignatureSpecSchema = z.object({
  since: z.string(),
  until: z.string().optional(),
  minArity: z.number().int().min(0),
  maxArity: z.number().min(0), // Infinity allowed
  params: z.array(ParameterSpecSchema),
});

export const ReplacementRefSchema = z.object({
  package: z.string(),
  export: z.string(),
  migrationHint: z.string(),
});

export const DeprecationEntrySchema = z.object({
  since: z.string(),
  removedIn: z.string().optional(),
  message: z.string(),
  replacement: ReplacementRefSchema.optional(),
});

export const ApiSpecSchema = z.object({
  package: z.string(),
  export: z.string(),
  kind: z.enum(["function", "component", "type", "constant", "class", "hook"]),
  availableIn: z.string(),
  signatures: z.array(SignatureSpecSchema),
  deprecations: z.array(DeprecationEntrySchema),
  docsUrl: z.string().optional(),
});

export const AuthorityPackageEntrySchema = z.object({
  name: z.string(),
  latestMappedVersion: z.string(),
  specFile: z.string(),
});

export const AuthorityManifestSchema = z.object({
  schemaVersion: z.number().int().min(1),
  dataVersion: z.string(),
  packages: z.array(AuthorityPackageEntrySchema),
});

/** Schema for a single authority data file (array of ApiSpec) */
export const AuthorityDataFileSchema = z.object({
  schemaVersion: z.number().int().min(1),
  package: z.string(),
  specs: z.array(ApiSpecSchema),
});

// ─── Config Schema ────────────────────────────────────────────────

const ViolationKindSchema = z.enum([
  "deprecated-api",
  "removed-api",
  "future-api",
  "wrong-arity",
  "wrong-param",
  "unknown-export",
]);

const SeveritySchema = z.enum(["error", "warning", "info"]);

export const SuppressionRuleSchema = z.object({
  package: z.string().optional(),
  export: z.string().optional(),
  kind: z.union([ViolationKindSchema, z.literal("*")]).default("*"),
  paths: z.array(z.string()).optional(),
  reason: z.string(),
});

export const DoxyConfigSchema = z.object({
  include: z.array(z.string()).default(["src/**/*.{ts,tsx,js,jsx}"]),
  exclude: z
    .array(z.string())
    .default(["**/*.test.*", "**/*.spec.*", "**/node_modules/**"]),
  severity: SeveritySchema.default("warning"),
  failOn: SeveritySchema.default("error"),
  frameworks: z.record(z.string()).default({}),
  pathAliases: z.record(z.string()).default({}),
  suppressions: z.array(SuppressionRuleSchema).default([]),
  requireSuppressionReason: z.boolean().default(false),
  authorityDataSources: z.array(z.string()).default(["builtin"]),
});

// ─── Cache Schema ─────────────────────────────────────────────────

export const SourceLocationSchema = z.object({
  file: z.string(),
  line: z.number().int().min(1),
  column: z.number().int().min(0),
  endLine: z.number().int().min(1).optional(),
  endColumn: z.number().int().min(0).optional(),
});

export const FindingSchema = z.object({
  id: z.string(),
  longId: z.string(),
  kind: ViolationKindSchema,
  severity: SeveritySchema,
  location: SourceLocationSchema,
  message: z.string(),
  symbol: z.object({
    package: z.string(),
    export: z.string(),
    installedVersion: z.string(),
  }),
  fixes: z.array(
    z.object({
      description: z.string(),
      replacement: z
        .object({
          location: SourceLocationSchema,
          newText: z.string(),
        })
        .optional(),
      referenceUrl: z.string().optional(),
    }),
  ),
  authorityRef: z.object({
    dataVersion: z.string(),
    specKey: z.string(),
  }),
  suppressed: z
    .object({
      source: z.enum(["inline", "config", "baseline"]),
      reason: z.string(),
    })
    .optional(),
});

export const FileCacheEntrySchema = z.object({
  filePath: z.string(),
  contentHash: z.string(),
  authorityVersion: z.string(),
  repoContextHash: z.string(),
  importedPackages: z.array(z.string()),
  packageVersions: z.record(z.string()),
  unresolvedImports: z.array(z.string()),
  findings: z.array(FindingSchema),
  analyzedAt: z.number(),
});

export const CacheStoreSchema = z.object({
  entries: z.record(FileCacheEntrySchema),
  createdAt: z.number(),
  doxyVersion: z.string(),
});

// ─── Baseline Schema ──────────────────────────────────────────────

export const BaselineSchema = z.object({
  findingIds: z.array(z.string()),
  createdAt: z.number(),
  doxyVersion: z.string(),
});
