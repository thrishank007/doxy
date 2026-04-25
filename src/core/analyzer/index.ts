import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { coerce, gte, minVersion } from "semver";
import { loadConfig } from "../../cli/config.js";
import { loadBuiltinAuthority } from "../../authority/index.js";
import { detectAdapters } from "../../adapters/index.js";
import { SwcParser } from "../../parser/index.js";
import { collectSourceFiles, toProjectRelative } from "../files/index.js";
import { buildRepoContext } from "../repo-context/index.js";
import {
  findMatchingSuppressionRule,
  isLineSuppressed,
  parseInlineSuppressions,
} from "../suppression/index.js";
import {
  makeLongId,
  SEVERITY_MAP,
  type AuthorityStore,
  type DoxyConfig,
  type Finding,
  type RepoContext,
  type SymbolUsage,
  type ViolationKind,
} from "../types/index.js";

export interface AnalyzeProjectOptions {
  root: string;
  files?: string[];
  config?: DoxyConfig;
}

export interface AnalyzeProjectResult {
  findings: Finding[];
  files: string[];
  config: DoxyConfig;
  repoContext: RepoContext;
  authority: AuthorityStore;
}

const parser = new SwcParser();

export async function analyzeProject(
  options: AnalyzeProjectOptions,
): Promise<AnalyzeProjectResult> {
  const config = options.config ?? await loadConfig(options.root);
  const repoContext = await buildRepoContext(options.root, config);
  const authority = await loadBuiltinAuthority();
  const adapters = detectAdapters(repoContext);
  const files = await collectSourceFiles({
    root: options.root,
    include: config.include,
    exclude: config.exclude,
    explicitFiles: options.files,
  });

  const fileFindings = await Promise.all(
    files.map(async (file) => {
      const source = await readFile(file, "utf-8");
      const relativeFile = toProjectRelative(options.root, file);
      const ast = parser.parse(source, relativeFile);
      const inlineSuppressions = parseInlineSuppressions(source);
      const usages = adapters.flatMap((adapter) =>
        adapter.resolveSymbols(ast.imports, ast),
      );

      return buildFindingsForUsages(
        usages,
        inlineSuppressions,
        repoContext,
        authority,
        config,
      );
    }),
  );

  return {
    findings: fileFindings
      .flat()
      .sort(compareFindings),
    files,
    config,
    repoContext,
    authority,
  };
}

function buildFindingsForUsages(
  usages: SymbolUsage[],
  inlineSuppressions: ReturnType<typeof parseInlineSuppressions>,
  repoContext: RepoContext,
  authority: AuthorityStore,
  config: DoxyConfig,
): Finding[] {
  const findings: Finding[] = [];

  for (const usage of usages) {
    const dependency = repoContext.dependencies[usage.package];
    const installedVersion = dependency?.resolvedVersion ?? dependency?.declaredRange;
    if (!installedVersion) continue;

    const resolved = authority.getApiSpec(
      usage.package,
      usage.export,
      installedVersion,
    );

    for (const site of usage.usageSites) {
      const finding = buildFindingForUsageSite(
        usage,
        site,
        installedVersion,
        resolved,
        authority,
      );
      if (!finding) continue;

      const inlineSuppression = isLineSuppressed(
        finding.location.line,
        finding.kind,
        inlineSuppressions,
      );
      if (inlineSuppression) continue;

      const configSuppression = findMatchingSuppressionRule(
        finding,
        config.suppressions,
      );
      if (configSuppression) continue;

      findings.push(finding);
    }
  }

  return findings;
}

function buildFindingForUsageSite(
  usage: SymbolUsage,
  site: SymbolUsage["usageSites"][number],
  installedVersion: string,
  resolved: ReturnType<AuthorityStore["getApiSpec"]>,
  authority: AuthorityStore,
): Finding | undefined {
  if (!resolved) {
    return undefined;
  }

  const removedIn = resolved.activeDeprecation?.removedIn;
  const installed = coerce(installedVersion);
  const removed = removedIn && installed && coerce(removedIn)
    ? gte(installed, coerce(removedIn)!)
    : false;

  if (!resolved.available) {
    if (resolved.isFuture) {
      return makeFinding(
        "future-api",
        usage,
        site.location,
        installedVersion,
        authority.dataVersion(),
        `${usage.package}.${usage.export} is not available in ${installedVersion}. It was added in ${minVersion(resolved.spec.availableIn)?.version}.`,
        resolved.spec.docsUrl,
      );
    }

    if (removed) {
      return makeFinding(
        "removed-api",
        usage,
        site.location,
        installedVersion,
        authority.dataVersion(),
        `${usage.package}.${usage.export} was removed in ${removedIn}. ${summarizeDeprecationTail(usage.package, usage.export, resolved.activeDeprecation?.message)}`,
        resolved.spec.docsUrl,
        resolved.activeDeprecation?.replacement?.migrationHint,
      );
    }

    return undefined;
  }

  if (resolved.activeDeprecation) {
    return makeFinding(
      "deprecated-api",
      usage,
      site.location,
      installedVersion,
      authority.dataVersion(),
      `${usage.package}.${usage.export} is deprecated since ${resolved.activeDeprecation.since}. ${summarizeDeprecationTail(usage.package, usage.export, resolved.activeDeprecation.message)}`,
      resolved.spec.docsUrl,
      resolved.activeDeprecation.replacement?.migrationHint,
    );
  }

  if (
    site.argCount !== undefined &&
    resolved.activeSignature &&
    (site.argCount < resolved.activeSignature.minArity ||
      site.argCount > resolved.activeSignature.maxArity)
  ) {
    return makeFinding(
      "wrong-arity",
      usage,
      site.location,
      installedVersion,
      authority.dataVersion(),
      `${usage.package}.${usage.export} expects ${formatArityRange(resolved.activeSignature.minArity, resolved.activeSignature.maxArity)} arguments, but was called with ${site.argCount}.`,
      resolved.spec.docsUrl,
    );
  }

  return undefined;
}

function summarizeDeprecationTail(
  packageName: string,
  exportName: string,
  message: string | undefined,
): string {
  if (!message) return "See package docs for migration guidance.";

  const prefixes = [
    `${packageName}.${exportName} is deprecated. `,
    `${packageName}.${exportName} was removed. `,
  ];

  for (const prefix of prefixes) {
    if (message.startsWith(prefix)) {
      return message.slice(prefix.length);
    }
  }

  return message;
}

function formatArityRange(minArity: number, maxArity: number): string {
  return minArity === maxArity ? `${minArity}` : `${minArity}-${maxArity}`;
}

function makeFinding(
  kind: ViolationKind,
  usage: SymbolUsage,
  location: Finding["location"],
  installedVersion: string,
  dataVersion: string,
  message: string,
  docsUrl?: string,
  migrationHint?: string,
): Finding {
  const longId = makeLongId(
    usage.package,
    usage.export,
    location.file,
    location.line,
    location.column,
  );

  return {
    id: `dxy_${createHash("sha256").update(longId).digest("hex").slice(0, 8)}`,
    longId,
    kind,
    severity: SEVERITY_MAP[kind],
    location,
    message,
    symbol: {
      package: usage.package,
      export: usage.export,
      installedVersion,
    },
    fixes: [
      {
        description: migrationHint ?? "See package documentation for migration guidance.",
        referenceUrl: docsUrl,
      },
    ],
    authorityRef: {
      dataVersion,
      specKey: `${usage.package}/${usage.export}`,
    },
  };
}

function compareFindings(a: Finding, b: Finding): number {
  return (
    a.location.file.localeCompare(b.location.file) ||
    a.location.line - b.location.line ||
    a.location.column - b.location.column ||
    a.kind.localeCompare(b.kind)
  );
}
