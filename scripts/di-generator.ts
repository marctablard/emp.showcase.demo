#!/usr/bin/env ts-node
import * as fs from 'node:fs';
import * as path from 'node:path';
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
import * as ts from 'typescript';
import type { Decorator } from 'typescript';
import * as glob from 'glob';
import * as chokidar from 'chokidar';
import {
  generateAliasBindings,
  resolveGeneratorAliases,
} from '../src/platform/core/di/search-service-alias';

/** Strip leading and trailing underscores without a backtracking-prone regex. */
function stripEdgeUnderscores(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === '_') start++;
  while (end > start && value[end - 1] === '_') end--;
  return value.slice(start, end);
}

type DependencyAliasConfig = {
  Services?: Record<string, string> | Array<Record<string, string>>;
  Integrations?: Record<string, string> | Array<Record<string, string>>;
  Repositories?: Record<string, string> | Array<Record<string, string>>;
};

function resolveDependencyFilePath(): string | null {
  const explicit = process.env.DI_DEPENDENCY_FILE;
  if (explicit) {
    const explicitPath = path.isAbsolute(explicit)
      ? explicit
      : path.join(process.cwd(), explicit);
    return fs.existsSync(explicitPath) ? explicitPath : null;
  }

  const envName = (process.env.DI_ENV || process.env.NODE_ENV || '').trim();
  if (envName) {
    const envPath = path.join(process.cwd(), `src/platform/depency.${envName}.yml`);
    if (fs.existsSync(envPath)) return envPath;
  }

  const defaultPath = path.join(process.cwd(), 'src/platform/depency.yml');
  return fs.existsSync(defaultPath) ? defaultPath : null;
}

/**
 * Reads the `AlwaysInclude:` section of depency.yml. Each env-keyed list provides
 * service IDs that must survive pruning regardless of whether the static analyzer can
 * see them in source — typically used for IDs sourced from environment variables (e.g.
 * `NEXT_SETUP_STEP_SERVICES`) or other configuration the analyzer cannot follow.
 *
 * Accepted shapes:
 *   AlwaysInclude:
 *     Server: [SetupService, FileBasedSetupService]
 *     Client: []
 *     SSR: [SsrService]
 */
function tryParseAlwaysInclude(): Record<'server' | 'client' | 'ssr', string[]> {
  const empty = { server: [] as string[], client: [] as string[], ssr: [] as string[] };
  try {
    const dependencyFilePath = resolveDependencyFilePath();
    if (!dependencyFilePath) return empty;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const yaml = require('js-yaml');
    const raw = fs.readFileSync(dependencyFilePath, 'utf8');
    const parsed = (yaml.load(raw) || {}) as Record<string, unknown>;
    const section = parsed.AlwaysInclude;
    if (!section || typeof section !== 'object' || Array.isArray(section)) return empty;

    const result = { server: [] as string[], client: [] as string[], ssr: [] as string[] };
    const envKeyMap: Record<string, 'server' | 'client' | 'ssr'> = {
      Server: 'server', server: 'server',
      Client: 'client', client: 'client',
      SSR: 'ssr', ssr: 'ssr', Ssr: 'ssr',
    };
    for (const [key, value] of Object.entries(section as Record<string, unknown>)) {
      const env = envKeyMap[key];
      if (!env || !Array.isArray(value)) continue;
      for (const id of value) {
        if (typeof id === 'string' && id.trim()) result[env].push(id.trim());
      }
    }
    return result;
  } catch (error) {
    console.error('Error reading/parsing AlwaysInclude in depency.yml:', error);
    return empty;
  }
}

/**
 * Reads the `AllowDynamicLookups:` section of depency.yml — repo-relative POSIX paths of
 * files whose container lookups resolve their service ID at runtime. Listing a file is an
 * explicit statement that the IDs it can reach are pinned under `AlwaysInclude:`; anything
 * unlisted fails the prune run rather than being silently dropped.
 *
 * Shape:
 *   AllowDynamicLookups:
 *     - src/app/api/setup/route.ts
 */
function tryParseAllowDynamicLookups(): string[] {
  try {
    const dependencyFilePath = resolveDependencyFilePath();
    if (!dependencyFilePath) return [];
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const yaml = require('js-yaml');
    const raw = fs.readFileSync(dependencyFilePath, 'utf8');
    const parsed = (yaml.load(raw) || {}) as Record<string, unknown>;
    const section = parsed.AllowDynamicLookups;
    if (!Array.isArray(section)) return [];
    return section
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .map((entry) => toPosix(entry.trim()));
  } catch (error) {
    console.error('Error reading/parsing AllowDynamicLookups in depency.yml:', error);
    return [];
  }
}

function tryParseDependencyAliases(): Array<{ alias: string; target: string }> {
  try {
    const dependencyFilePath = resolveDependencyFilePath();
    if (!dependencyFilePath) return [];
    if (DEBUG) console.debug(`[DI] Using dependency alias config: ${dependencyFilePath}`);

    // Lazy-require to avoid hard dependency if not installed in some environments.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const yaml = require('js-yaml');
    const raw = fs.readFileSync(dependencyFilePath, 'utf8');
    const parsed = (yaml.load(raw) || {}) as DependencyAliasConfig;

    const sections: Array<keyof DependencyAliasConfig> = ['Services', 'Integrations', 'Repositories'];
    const aliases: Array<{ alias: string; target: string }> = [];

    for (const section of sections) {
      const entries = parsed[section];

      // New (clean) format:
      // Services:
      //   SearchService: BatteryIncludedSearchService
      if (entries && !Array.isArray(entries) && typeof entries === 'object') {
        for (const [alias, target] of Object.entries(entries as Record<string, unknown>)) {
          if (typeof target !== 'string') continue;
          const a = String(alias).trim();
          const t = target.trim();
          if (!a || !t) continue;
          aliases.push({ alias: a, target: t });
        }
        continue;
      }

      // Backward-compatible format:
      // Services:
      // - SearchService: BatteryIncludedSearchService
      if (!entries || !Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (!entry || typeof entry !== 'object') continue;
        for (const [alias, target] of Object.entries(entry)) {
          if (typeof target !== 'string') continue;
          const a = String(alias).trim();
          const t = target.trim();
          if (!a || !t) continue;
          aliases.push({ alias: a, target: t });
        }
      }
    }

    return aliases;
  } catch (error) {
    console.error('Error reading/parsing src/platform/depency.yml:', error);
    return [];
  }
}

// Configuration
const DEBUG = process.env.DEBUG === 'true';
const EXTENSIONS_DIR = path.join(process.cwd(), 'extensions');
const PRUNE = process.env.DI_PRUNE === 'true' || process.argv.slice(2).includes('--prune');
/**
 * Escape hatch for prune mode: downgrade unacknowledged runtime-resolved container lookups
 * from a hard failure to a warning. Useful while iterating locally; not for CI builds,
 * where a silently pruned service is exactly the failure this guard exists to prevent.
 */
const ALLOW_UNACKNOWLEDGED_LOOKUPS = process.env.DI_PRUNE_ALLOW_DYNAMIC === 'true';

// Extension plugin manifest
interface PluginManifest {
  name: string;
  description?: string;
  version?: string;
  enabled: boolean;
  aliases?: Record<string, string>;
  setup?: string[];
}

// Information about a discovered extension
interface ExtensionInfo {
  name: string;
  directory: string;
  manifest: PluginManifest;
  injectables: InjectableInfo[];
}

// Define the layers we support
type Layer = 'integration' | 'service' | 'repository' | 'platform';

// Configuration for each layer
const LAYER_CONFIGS: Record<
  Layer,
  { directory: string; serverOutputFile: string; clientOutputFile: string; ssrOutputFile: string }
> = {
  integration: {
    directory: path.join(process.cwd(), 'src/platform/integrations'),
    ssrOutputFile: path.join(process.cwd(), 'src/platform/integrations/ssr.ts'),
    serverOutputFile: path.join(process.cwd(), 'src/platform/integrations/server.ts'),
    clientOutputFile: path.join(process.cwd(), 'src/platform/integrations/client.ts')
  },
  service: {
    directory: path.join(process.cwd(), 'src/platform/services'),
    ssrOutputFile: path.join(process.cwd(), 'src/platform/services/ssr.ts'),
    serverOutputFile: path.join(process.cwd(), 'src/platform/services/server.ts'),
    clientOutputFile: path.join(process.cwd(), 'src/platform/services/client.ts')
  },
  repository: {
    directory: path.join(process.cwd(), 'src/platform/repositories'),
    ssrOutputFile: path.join(process.cwd(), 'src/platform/repositories/ssr.ts'),
    serverOutputFile: path.join(process.cwd(), 'src/platform/repositories/server.ts'),
    clientOutputFile: path.join(process.cwd(), 'src/platform/repositories/client.ts')
  },
  platform: {
    directory: path.join(process.cwd(), 'src/platform'),
    ssrOutputFile: path.join(process.cwd(), 'src/platform/ssr.ts'),
    serverOutputFile: path.join(process.cwd(), 'src/platform/server.ts'),
    clientOutputFile: path.join(process.cwd(), 'src/platform/client.ts')
  }
};

// Information about an injectable class
interface InjectableInfo {
  className: string;
  serviceId: string;
  scope: string;
  filePath: string;
  relativePath: string;
  isClientOnly: boolean;
  isServerOnly: boolean;
  isSsrOnly: boolean;
  hasServerOnlyImport: boolean;
  dependencies: string[];
}

// Matches `import 'server-only'` / `import "server-only"` (with or without trailing
// semicolon) anywhere in a file. The leading `^\s*import` anchor avoids matching
// commented-out forms like `// import 'server-only'`.
const SERVER_ONLY_IMPORT_RE = /^\s*import\s+["']server-only["']/m;

/**
 * Scans TypeScript files for classes decorated with @injectable
 * @param directory The directory to scan
 * @returns An array of injectable class information
 */
/** Decorators attached to a node, which TypeScript exposes through `modifiers`. */
function getDecorators(node: ts.ClassDeclaration | ts.ParameterDeclaration): Decorator[] {
  const decorators: Decorator[] = [];
  for (const modifier of node.modifiers ?? []) {
    if (modifier.kind === ts.SyntaxKind.Decorator) decorators.push(modifier as Decorator);
  }
  return decorators;
}

/** `{ serviceId, scope }` from an `@injectable('Id', 'Scope')` decorator, or null. */
function extractInjectableArgs(
  node: ts.ClassDeclaration,
  sourceFile: ts.SourceFile
): { serviceId: string; scope: string } | null {
  const injectableDecorator = getDecorators(node).find((decorator) => {
    const text = decorator.expression.getText(sourceFile);
    return text.startsWith('injectable(') || text.startsWith('@injectable(');
  });
  if (!injectableDecorator) return null;

  const decoratorText = injectableDecorator.expression.getText(sourceFile);
  const match = /injectable\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"]\)/.exec(decoratorText);
  if (!match) return null;

  return { serviceId: match[1], scope: match[2] };
}

/** Service IDs from `@inject('Id')` decorators on constructor parameters. */
function extractConstructorDependencies(node: ts.ClassDeclaration, sourceFile: ts.SourceFile): string[] {
  const ctor = node.members.find((m): m is ts.ConstructorDeclaration => ts.isConstructorDeclaration(m));
  if (!ctor) return [];

  const dependencies: string[] = [];
  for (const param of ctor.parameters) {
    for (const decorator of getDecorators(param)) {
      const injectMatch = /inject\(\s*['"]([^'"]+)['"]\s*\)/.exec(decorator.expression.getText(sourceFile));
      if (injectMatch) dependencies.push(injectMatch[1]);
    }
  }
  return dependencies;
}

/** Describe an `@injectable` class declaration, or null when the node is not one. */
function toInjectableInfo(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  directory: string,
  filePath: string,
  hasServerOnlyImport: boolean
): InjectableInfo | null {
  if (!ts.isClassDeclaration(node) || !node.name) return null;

  const injectableArgs = extractInjectableArgs(node, sourceFile);
  if (!injectableArgs) return null;

  const className = node.name.text;
  const relativePath = toPosix(path.relative(directory, filePath)).replace(/\.tsx?$/, '');

  return {
    className,
    serviceId: injectableArgs.serviceId,
    scope: injectableArgs.scope,
    filePath,
    relativePath,
    // The env suffix on the class name decides which container the injectable lands in.
    isClientOnly: className.endsWith('Client'),
    isServerOnly: className.endsWith('Server'),
    isSsrOnly: className.endsWith('SSR'),
    hasServerOnlyImport,
    dependencies: extractConstructorDependencies(node, sourceFile),
  };
}

async function scanForInjectables(directory: string): Promise<InjectableInfo[]> {
  const injectables: InjectableInfo[] = [];
  
  // Find all TypeScript files in the directory
  const files = glob.sync('**/*.{ts,tsx}', {
    cwd: directory,
    ignore: ['**/*.d.ts', '**/node_modules/**', '**/dist/**', '**/build/**'],
    absolute: true,
  });
  
  if (DEBUG) console.debug(`Found ${files.length} TypeScript files in ${directory}`);
  
  // Process each file
  for (const filePath of files) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const hasServerOnlyImport = SERVER_ONLY_IMPORT_RE.test(fileContent);
      const sourceFile = ts.createSourceFile(
        filePath,
        fileContent,
        ts.ScriptTarget.Latest,
        true
      );
      
      // Find classes with @injectable decorator
      ts.forEachChild(sourceFile, (node) => {
        const found = toInjectableInfo(node, sourceFile, directory, filePath, hasServerOnlyImport);
        if (!found) return;
        injectables.push(found);
        if (DEBUG) {
          console.debug(
            `Found injectable class: ${found.className} (${found.serviceId}, ${found.scope}) in ` +
              `${found.relativePath} -> deps: [${found.dependencies.join(', ')}]`
          );
        }
      });
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
    }
  }
  
  return injectables;
}

/**
 * Scans the extensions/ directory for plugin.json manifests and discovers their injectables.
 */
async function scanExtensions(): Promise<ExtensionInfo[]> {
  const extensions: ExtensionInfo[] = [];

  if (!fs.existsSync(EXTENSIONS_DIR)) {
    if (DEBUG) console.debug('No extensions directory found, skipping extension scan');
    return extensions;
  }

  const entries = fs.readdirSync(EXTENSIONS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const pluginDir = path.join(EXTENSIONS_DIR, entry.name);
    const manifestPath = path.join(pluginDir, 'plugin.json');

    if (!fs.existsSync(manifestPath)) {
      if (DEBUG) console.debug(`Skipping ${entry.name}: no plugin.json found`);
      continue;
    }

    try {
      const manifest: PluginManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      if (!manifest.enabled) {
        console.log(`Extension '${manifest.name}' is disabled, skipping`);
        continue;
      }

      // Scan for injectables inside the extension directory
      const extInjectables = (await scanForInjectables(pluginDir))
        .filter(injectable => injectable.className !== 'default');

      console.log(`Extension '${manifest.name}': found ${extInjectables.length} injectable(s)`);

      extensions.push({
        name: manifest.name,
        directory: pluginDir,
        manifest,
        injectables: extInjectables,
      });
    } catch (error) {
      console.error(`Error loading extension '${entry.name}':`, error);
    }
  }

  return extensions;
}

type ConsumerEnv = 'server' | 'client' | 'ssr';

const CONSUMER_ENVS: ConsumerEnv[] = ['server', 'client', 'ssr'];

/** Normalize Windows separators so path comparisons and log output stay stable. */
function toPosix(value: string): string {
  return value.replaceAll('\\', '/');
}

/** Repo-relative POSIX path, so warnings are copy-pasteable regardless of platform. */
function toRepoRelative(filePath: string): string {
  return toPosix(path.relative(process.cwd(), filePath));
}

const CONTAINER_FILE_PATHS: Record<ConsumerEnv, string> = {
  server: toPosix(path.join(process.cwd(), 'src/platform/server.ts')),
  client: toPosix(path.join(process.cwd(), 'src/platform/client.ts')),
  ssr: toPosix(path.join(process.cwd(), 'src/platform/ssr.ts')),
};

/** Container methods whose first argument is a service ID. */
const CONTAINER_METHODS = new Set(['get', 'getAll', 'isBound', 'bind', 'unbind']);

/**
 * Resolve an import specifier to one of the three platform container envs, or null.
 * Handles `@/` path aliases and relative imports.
 */
function resolveImportToContainer(importPath: string, fromFile: string): ConsumerEnv | null {
  let resolved: string;
  if (importPath.startsWith('@/')) {
    resolved = path.join(process.cwd(), 'src', importPath.slice(2));
  } else if (importPath.startsWith('.')) {
    resolved = path.resolve(path.dirname(fromFile), importPath);
  } else {
    return null;
  }
  const normalized = toPosix(resolved).replace(/\.(ts|tsx|js|jsx)$/, '');
  for (const env of Object.keys(CONTAINER_FILE_PATHS) as ConsumerEnv[]) {
    const target = CONTAINER_FILE_PATHS[env].replace(/\.(ts|tsx)$/, '');
    if (normalized === target) return env;
  }
  return null;
}

/** Every scannable source file, excluding the generated containers themselves. */
function collectScannableFiles(): string[] {
  const files = glob.sync('{src,extensions}/**/*.{ts,tsx}', {
    cwd: process.cwd(),
    ignore: ['**/*.d.ts', '**/node_modules/**', '**/dist/**', '**/build/**'],
    absolute: true,
  });
  const generated = new Set(Object.values(CONTAINER_FILE_PATHS));
  return files.filter((filePath) => !generated.has(toPosix(filePath)));
}

/** Read and parse one file; null when it cannot be read. */
function readSourceFile(filePath: string): { content: string; sourceFile: ts.SourceFile } | null {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
  return { content, sourceFile: ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true) };
}

/**
 * Map local identifiers bound to a platform container onto their env, e.g.
 * `import server from '@/platform/server'` -> `{ server: 'server' }`.
 */
function collectContainerBindings(sourceFile: ts.SourceFile, filePath: string): Map<string, ConsumerEnv> {
  const bindingToEnv = new Map<string, ConsumerEnv>();
  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isImportDeclaration(node)) return;
    const moduleSpec = node.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpec)) return;
    const env = resolveImportToContainer(moduleSpec.text, filePath);
    if (!env) return;
    const importClause = node.importClause;
    if (!importClause) return;
    if (importClause.name) bindingToEnv.set(importClause.name.text, env);
    if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
      bindingToEnv.set(importClause.namedBindings.name.text, env);
    }
  });
  return bindingToEnv;
}

/**
 * Nearest enclosing named function for a node. Used to suppress reports when a non-literal
 * lookup lives inside a known proxy — the literal shows up at the proxy's call sites.
 */
function findEnclosingFunctionName(node: ts.Node): string | undefined {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
    if ((ts.isArrowFunction(current) || ts.isFunctionExpression(current)) && current.parent) {
      const parent = current.parent;
      if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
    }
    current = current.parent;
  }
  return undefined;
}

type ProxyInfo = { env: ConsumerEnv; idArgIndex: number };

/** Where a forwarded parameter ends up: a container method, or another function. */
type ProxyVia = { kind: 'container'; env: ConsumerEnv } | { kind: 'proxy'; name: string };

type ProxyTarget = { idArgIndex: number; via: ProxyVia };

type ProxyCandidate = { name: string; targets: ProxyTarget[] };

/** Classify a call's callee: a container method, a hop through another function, or neither. */
function classifyForwardingCallee(
  callee: ts.Expression,
  bindingToEnv: Map<string, ConsumerEnv>
): ProxyVia | null {
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
    const env = bindingToEnv.get(callee.expression.text);
    if (!env || !CONTAINER_METHODS.has(callee.name.text)) return null;
    return { kind: 'container', env };
  }
  if (ts.isIdentifier(callee)) return { kind: 'proxy', name: callee.text };
  return null;
}

/** Target for a single node, or null when it does not forward one of `paramNames`. */
function toForwardingTarget(
  node: ts.Node,
  paramNames: Array<string | null>,
  bindingToEnv: Map<string, ConsumerEnv>
): ProxyTarget | null {
  if (!ts.isCallExpression(node)) return null;
  const firstArg = node.arguments[0];
  if (!firstArg || !ts.isIdentifier(firstArg)) return null;
  const idArgIndex = paramNames.indexOf(firstArg.text);
  if (idArgIndex < 0) return null;
  const via = classifyForwardingCallee(node.expression, bindingToEnv);
  return via ? { idArgIndex, via } : null;
}

/**
 * Every call in `body` that forwards one of `paramNames` as its first argument, recorded as
 * either a direct container hit or a hop through another (possibly not-yet-known) function.
 * All of them are collected because a body may forward unrelated params first
 * (e.g. `useRef(initialData)`) before the meaningful one. Traversal stays pre-order: the
 * first resolvable target wins downstream, so ordering is behaviour, not cosmetics.
 */
function collectForwardingTargets(
  paramNames: Array<string | null>,
  body: ts.Node,
  bindingToEnv: Map<string, ConsumerEnv>
): ProxyTarget[] {
  const targets: ProxyTarget[] = [];

  const walk = (node: ts.Node): void => {
    const target = toForwardingTarget(node, paramNames, bindingToEnv);
    if (target) targets.push(target);
    ts.forEachChild(node, walk);
  };
  walk(body);

  return targets;
}

/** Named functions in one file that forward a parameter onward. */
function collectProxyCandidates(
  sourceFile: ts.SourceFile,
  bindingToEnv: Map<string, ConsumerEnv>
): ProxyCandidate[] {
  const candidates: ProxyCandidate[] = [];

  const inspectFunction = (
    funcName: string,
    params: ts.NodeArray<ts.ParameterDeclaration>,
    body: ts.Node
  ): void => {
    const paramNames = Array.from(params).map((p) => (ts.isIdentifier(p.name) ? p.name.text : null));
    if (!paramNames.some((name) => name !== null)) return;
    const targets = collectForwardingTargets(paramNames, body, bindingToEnv);
    if (targets.length > 0) candidates.push({ name: funcName, targets });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      inspectFunction(node.name.text, node.parameters, node.body);
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      inspectFunction(node.name.text, node.initializer.parameters, node.initializer.body);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  return candidates;
}

/** First target that bottoms out at a container, directly or via an already-resolved proxy. */
function findResolvableTarget(targets: ProxyTarget[], resolved: Map<string, ProxyInfo>): ProxyInfo | null {
  for (const target of targets) {
    if (target.via.kind === 'container') {
      return { env: target.via.env, idArgIndex: target.idArgIndex };
    }
    const dep = resolved.get(target.via.name);
    if (dep) return { env: dep.env, idArgIndex: target.idArgIndex };
  }
  return null;
}

/**
 * Iteratively resolve candidates until no progress is made; stranded ones (those that only
 * forward into functions which never reach a container) are silently dropped.
 */
function resolveProxyChains(candidates: ProxyCandidate[]): Map<string, ProxyInfo> {
  const resolved = new Map<string, ProxyInfo>();
  let pending = candidates;
  let progress = true;

  while (progress) {
    progress = false;
    const remaining: ProxyCandidate[] = [];
    for (const candidate of pending) {
      if (resolved.has(candidate.name)) continue;
      const hit = findResolvableTarget(candidate.targets, resolved);
      if (hit) {
        resolved.set(candidate.name, hit);
        progress = true;
      } else {
        remaining.push(candidate);
      }
    }
    pending = remaining;
  }

  return resolved;
}

/**
 * Auto-detect "DI proxy" functions: helpers whose body forwards one of their parameters
 * into a container's `.get/.isBound/.bind/.unbind/.getAll` (directly OR through another
 * known proxy). The classic case is `getService<T>(id) { return client.get<T>(id); }` and
 * its transitive caller `useValidator(validatorId) { return getService(validatorId); }`.
 *
 * Without this, a literal `useValidator('ShippingValidationService', ...)` is invisible
 * to the consumer scanner and the validator gets pruned.
 *
 * Returns a map from function name to {env, idArgIndex}. Env is inherited from whichever
 * container the chain bottoms out at. Functions are matched purely by name; renaming
 * imports (`import { foo as bar }`) is not currently traced — calls via `bar` won't be
 * detected.
 */
async function detectProxies(): Promise<Map<string, ProxyInfo>> {
  const candidates: ProxyCandidate[] = [];

  for (const filePath of collectScannableFiles()) {
    const parsed = readSourceFile(filePath);
    if (!parsed) continue;
    const bindingToEnv = collectContainerBindings(parsed.sourceFile, filePath);
    candidates.push(...collectProxyCandidates(parsed.sourceFile, bindingToEnv));
  }

  const resolved = resolveProxyChains(candidates);

  if (DEBUG && resolved.size > 0) {
    console.debug(
      '[DI prune debug] detected proxies:',
      Array.from(resolved.entries()).map(([name, info]) => `${name}->${info.env}[${info.idArgIndex}]`)
    );
  }

  return resolved;
}

/**
 * A container lookup whose service ID is not a string literal, so reachability analysis
 * cannot see which service it needs.
 */
type UntraceableLookup = {
  /** Repo-relative POSIX path. */
  file: string;
  /** 1-based line of the offending argument. */
  line: number;
  /** Call description, e.g. `server.get()` or `proxy useValidator() argument[0]`. */
  call: string;
};

type ConsumerScanResult = {
  /** Service IDs referenced per environment. */
  seeds: Record<ConsumerEnv, Set<string>>;
  /** Lookups the pruner could not resolve; the caller decides whether these are fatal. */
  untraceable: UntraceableLookup[];
};

/** Cheap prefilter: does this file mention a container import or any known proxy at all? */
function mentionsContainerOrProxy(content: string, proxies: Map<string, ProxyInfo>): boolean {
  if (
    content.includes('platform/server') ||
    content.includes('platform/client') ||
    content.includes('platform/ssr')
  ) {
    return true;
  }
  for (const proxyName of proxies.keys()) {
    if (content.includes(proxyName)) return true;
  }
  return false;
}

/** Everything the per-file seed collection needs, passed explicitly to keep helpers flat. */
type ConsumerScanContext = {
  sourceFile: ts.SourceFile;
  filePath: string;
  bindingToEnv: Map<string, ConsumerEnv>;
  proxies: Map<string, ProxyInfo>;
  seeds: Record<ConsumerEnv, Set<string>>;
  untraceable: UntraceableLookup[];
};

function recordUntraceableLookup(
  ctx: ConsumerScanContext,
  node: ts.Node,
  idArg: ts.Node,
  call: string
): void {
  // A non-literal inside a known proxy is fine: the literal appears at the proxy's call sites.
  const enclosing = findEnclosingFunctionName(node);
  if (enclosing && ctx.proxies.has(enclosing)) return;
  const { line } = ctx.sourceFile.getLineAndCharacterOfPosition(idArg.getStart(ctx.sourceFile));
  ctx.untraceable.push({ file: toRepoRelative(ctx.filePath), line: line + 1, call });
}

/** Direct container method call: `<binding>.<method>('Id', ...)`. */
function collectDirectContainerCall(
  ctx: ConsumerScanContext,
  node: ts.CallExpression,
  callee: ts.PropertyAccessExpression
): void {
  if (!ts.isIdentifier(callee.expression)) return;
  const env = ctx.bindingToEnv.get(callee.expression.text);
  if (!env || !CONTAINER_METHODS.has(callee.name.text)) return;

  const firstArg = node.arguments[0];
  if (!firstArg) return;
  if (ts.isStringLiteral(firstArg)) {
    ctx.seeds[env].add(firstArg.text);
    return;
  }
  recordUntraceableLookup(ctx, node, firstArg, `${callee.expression.text}.${callee.name.text}()`);
}

/** Known-proxy call: `<proxyName>('Id', ...)` where the proxy was detected upstream. */
function collectProxyLookupCall(
  ctx: ConsumerScanContext,
  node: ts.CallExpression,
  callee: ts.Identifier
): void {
  const proxy = ctx.proxies.get(callee.text);
  if (!proxy) return;

  const idArg = node.arguments[proxy.idArgIndex];
  if (!idArg) return;
  if (ts.isStringLiteral(idArg)) {
    ctx.seeds[proxy.env].add(idArg.text);
    return;
  }
  recordUntraceableLookup(ctx, node, idArg, `proxy ${callee.text}() argument[${proxy.idArgIndex}]`);
}

function collectSeedsFromFile(ctx: ConsumerScanContext): void {
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee)) collectDirectContainerCall(ctx, node, callee);
      if (ts.isIdentifier(callee)) collectProxyLookupCall(ctx, node, callee);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(ctx.sourceFile, visit);
}

async function scanConsumers(proxies: Map<string, ProxyInfo> = new Map()): Promise<ConsumerScanResult> {
  const seeds: Record<ConsumerEnv, Set<string>> = {
    server: new Set<string>(),
    client: new Set<string>(),
    ssr: new Set<string>(),
  };
  const untraceable: UntraceableLookup[] = [];

  for (const filePath of collectScannableFiles()) {
    const parsed = readSourceFile(filePath);
    if (!parsed) continue;
    if (!mentionsContainerOrProxy(parsed.content, proxies)) continue;

    collectSeedsFromFile({
      sourceFile: parsed.sourceFile,
      filePath,
      bindingToEnv: collectContainerBindings(parsed.sourceFile, filePath),
      proxies,
      seeds,
      untraceable,
    });
  }

  return { seeds, untraceable };
}

/**
 * BFS the dependency graph from a set of seed service IDs to find every service the
 * environment must contain. Aliases are resolved at every hop. Service IDs that don't
 * map to any injectable in this environment are skipped (e.g. an alias whose target is
 * provided in a different env).
 */
function computeReachable(
  seedIds: Set<string>,
  envInjectables: InjectableInfo[],
  aliases: Record<string, string>
): Set<string> {
  const idToInjectable = new Map<string, InjectableInfo>();
  for (const inj of envInjectables) idToInjectable.set(inj.serviceId, inj);

  const reachable = new Set<string>();
  const queue: string[] = [...seedIds];

  while (queue.length > 0) {
    let id = queue.shift()!;
    // Resolve one alias hop. depency.yml is flat, so single-hop is sufficient today;
    // a while loop here would handle hypothetical chains without breaking anything.
    while (aliases[id] && aliases[id] !== id) {
      reachable.add(id); // record the alias itself so its binding is retained
      id = aliases[id];
    }
    if (reachable.has(id)) continue;
    reachable.add(id);
    const inj = idToInjectable.get(id);
    if (!inj) continue;
    for (const dep of inj.dependencies) queue.push(dep);
  }

  return reachable;
}

/**
 * Injectables for one environment. Env-aware: env-suffixed variants (e.g.
 * `PinoLoggerServiceServer`) shadow common ones registered under the same serviceId.
 */
function buildEnvironmentInjectables(env: ConsumerEnv, list: InjectableInfo[]): InjectableInfo[] {
  let envInjectables: InjectableInfo[];
  switch (env) {
    case 'server':
      envInjectables = list.filter(i => i.isServerOnly);
      break;
    case 'client':
      envInjectables = list.filter(i => i.isClientOnly);
      break;
    case 'ssr':
      envInjectables = list.filter(i => i.isSsrOnly);
      break;
    default:
      envInjectables = [];
  }
  const isCommon = (injectable: InjectableInfo) =>
    !injectable.isClientOnly && !injectable.isServerOnly && !injectable.isSsrOnly;
  const isAlreadyInEnv = (i: InjectableInfo) => envInjectables.find((envI: InjectableInfo) => i.serviceId == envI.serviceId);
  const common = list.filter(isCommon).filter((i) => !isAlreadyInEnv(i));
  const combined = common.concat(envInjectables);

  // Files carrying `import 'server-only'` cannot load in the browser, so they
  // must never end up in the client container — even if their class name has
  // a `Client` suffix (which would be a source-file inconsistency worth warning about).
  if (env === 'client') {
    return combined.filter((i) => {
      if (!i.hasServerOnlyImport) return true;
      if (i.isClientOnly) {
        console.warn(
          `[DI] Excluding ${i.className} from client container: file ${i.relativePath} imports 'server-only' despite the Client suffix.`,
        );
      }
      return false;
    });
  }

  return combined;
}

/**
 * Untraceable lookups are fatal in prune mode: the IDs behind them are invisible to
 * reachability, so the services they need get dropped and the breakage only shows up at
 * runtime. Acknowledge a call site by listing its file under `AllowDynamicLookups:` in
 * depency.yml once every ID it can reach is pinned under `AlwaysInclude:`.
 */
function assertDynamicLookupsAreAcknowledged(untraceable: UntraceableLookup[]): void {
  if (untraceable.length === 0) return;

  const acknowledged = new Set(tryParseAllowDynamicLookups());
  const describe = (lookup: UntraceableLookup) => `  - ${lookup.file}:${lookup.line} — ${lookup.call}`;

  for (const lookup of untraceable.filter((lookup) => acknowledged.has(lookup.file))) {
    console.log(
      `[DI prune] Acknowledged dynamic lookup: ${lookup.call} at ${lookup.file}:${lookup.line} ` +
        `— its IDs must be listed under AlwaysInclude.`
    );
  }

  const blocking = untraceable.filter((lookup) => !acknowledged.has(lookup.file));
  if (blocking.length === 0) return;

  const details = blocking.map(describe).join('\n');

  if (ALLOW_UNACKNOWLEDGED_LOOKUPS) {
    console.warn(
      `[DI prune] ${blocking.length} untraceable lookup(s) downgraded to a warning because ` +
        `DI_PRUNE_ALLOW_DYNAMIC=true — the services they need may be pruned:\n${details}`
    );
    return;
  }

  throw new Error(
    `DI prune: ${blocking.length} container lookup(s) resolve their service ID at runtime, so pruning ` +
      `cannot tell which services they need and would silently drop them:\n${details}\n\n` +
      `Resolve it one of these ways:\n` +
      `  1. Pass a string literal at the call site so the pruner can trace it.\n` +
      `  2. List the reachable IDs under 'AlwaysInclude:' in src/platform/depency.yml, then add the ` +
      `file under 'AllowDynamicLookups:' to acknowledge the call site.\n` +
      `  3. Set DI_PRUNE_ALLOW_DYNAMIC=true to downgrade this to a warning (pruning stays on).`
  );
}

/**
 * Reachable service IDs per environment, seeded from real consumer call sites and expanded
 * across the dependency graph.
 */
async function computeReachableByEnv(
  injectables: InjectableInfo[],
  extensionInjectables: InjectableInfo[],
  extensionAliases: Record<string, string>
): Promise<Record<ConsumerEnv, Set<string>>> {
  console.log('[DI prune] Pruning enabled — detecting proxies + scanning consumer call sites...');
  const proxies = await detectProxies();
  if (proxies.size > 0) {
    console.log(`[DI prune] detected ${proxies.size} proxy function(s)`);
  }

  const { seeds, untraceable } = await scanConsumers(proxies);
  assertDynamicLookupsAreAcknowledged(untraceable);

  // AlwaysInclude allowlist for IDs that the static analyzer cannot trace
  // (typically env-var-sourced lookups like setup/route.ts).
  const alwaysInclude = tryParseAlwaysInclude();
  for (const env of CONSUMER_ENVS) {
    for (const id of alwaysInclude[env]) seeds[env].add(id);
  }
  const alwaysCount = alwaysInclude.server.length + alwaysInclude.client.length + alwaysInclude.ssr.length;
  if (alwaysCount > 0) {
    console.log(
      `[DI prune] AlwaysInclude — server:${alwaysInclude.server.length} client:${alwaysInclude.client.length} ssr:${alwaysInclude.ssr.length}`
    );
  }

  // Merged alias map (depency.yml + extension aliases + DI_SEARCH_SERVICE override).
  // Resolved through the same helper generateContainerFile uses, so reachability follows
  // exactly the targets that will be bound — otherwise an overridden SearchService
  // implementation would be pruned before it ever gets aliased.
  const mergedAliases = resolveGeneratorAliases({
    dependencyAliases: tryParseDependencyAliases(),
    extensionAliases,
    searchServiceOverride: process.env.DI_SEARCH_SERVICE,
  });

  const combined = injectables.concat(extensionInjectables);
  const reachableByEnv = {
    server: computeReachable(seeds.server, buildEnvironmentInjectables('server', combined), mergedAliases),
    client: computeReachable(seeds.client, buildEnvironmentInjectables('client', combined), mergedAliases),
    ssr: computeReachable(seeds.ssr, buildEnvironmentInjectables('ssr', combined), mergedAliases),
  };

  console.log(
    `[DI prune] consumer seeds — server:${seeds.server.size} client:${seeds.client.size} ssr:${seeds.ssr.size}`
  );
  console.log(
    `[DI prune] reachable set — server:${reachableByEnv.server.size} client:${reachableByEnv.client.size} ssr:${reachableByEnv.ssr.size}`
  );
  if (DEBUG) {
    for (const env of CONSUMER_ENVS) {
      console.debug(`[DI prune debug] ${env} seeds:`, Array.from(seeds[env]));
    }
  }

  return reachableByEnv;
}

/**
 * Generates the container files with static imports
 * @param layer The layer for which to generate the container
 */
async function generateContainerFiles(layer: Layer): Promise<void> {
  const { directory, serverOutputFile, clientOutputFile, ssrOutputFile } = LAYER_CONFIGS[layer];
  if (DEBUG) console.debug(`Scanning ${layer} layer in directory: ${directory}`);
  
  // Scan for injectables in this specific directory
  const injectables = (await scanForInjectables(directory)).filter(injectable => injectable.className !== 'default');
  if (DEBUG) console.info(`Found ${injectables.length} injectable classes for ${layer} layer`);

  // Scan extensions
  const extensions = await scanExtensions();
  const extensionInjectables = extensions.flatMap(ext => ext.injectables);
  if (extensionInjectables.length > 0) {
    console.log(`Found ${extensionInjectables.length} injectable(s) from ${extensions.length} extension(s)`);
  }

  // Collect all aliases from enabled extensions
  const aliases: Record<string, string> = {};
  for (const ext of extensions) {
    if (ext.manifest.aliases) {
      Object.assign(aliases, ext.manifest.aliases);
    }
  }

  // When pruning is enabled, compute the reachable set per environment by walking the
  // dependency graph from real consumer-side container.get/isBound/etc. call sites.
  const reachableByEnv = PRUNE
    ? await computeReachableByEnv(injectables, extensionInjectables, aliases)
    : null;

  const forEnv = (env: ConsumerEnv) => buildEnvironmentInjectables(env, injectables);

  await generateContainerFile(layer, forEnv('server'), serverOutputFile, 'server', extensions, aliases, reachableByEnv?.server);
  await generateContainerFile(layer, forEnv('client'), clientOutputFile, 'client', extensions, aliases, reachableByEnv?.client);
  await generateContainerFile(layer, forEnv('ssr'), ssrOutputFile, 'ssr', extensions, aliases, reachableByEnv?.ssr);
}

/** Import identifier for an injectable, derived from its file name. */
function toModuleName(relativePath: string): string {
  return stripEdgeUnderscores(path.basename(relativePath).replaceAll(/\W/g, '_'));
}

/**
 * Fail fast when two injectables would produce the same import identifier: the generated
 * container would either not compile or bind the wrong module. Checked against the
 * post-prune set, so only identifiers that actually reach the generated file can clash.
 */
function assertNoModuleNameCollisions(injectables: InjectableInfo[]): void {
  const seen = new Map<string, string>();
  for (const injectable of injectables) {
    const moduleName = toModuleName(injectable.relativePath);
    const previous = seen.get(moduleName);
    if (previous) {
      throw new Error(
        `DI generator: import name collision "${moduleName}" between ` +
        `"${previous}" and "${injectable.relativePath}". ` +
        `Rename one of the files to avoid ambiguity.`,
      );
    }
    seen.set(moduleName, injectable.relativePath);
  }
}

/** Drop platform injectables that no consumer call site can reach in this environment. */
function prunePlatformInjectables(
  injectables: InjectableInfo[],
  type: ConsumerEnv,
  reachable?: Set<string>
): InjectableInfo[] {
  if (!reachable) return injectables;
  const kept = injectables.filter((i) => reachable.has(i.serviceId));
  console.log(`[DI prune] ${type}: kept ${kept.length}/${injectables.length} platform injectable(s)`);
  return kept;
}

type ExtensionImports = {
  importLines: string[];
  moduleNames: string[];
  kept: number;
  total: number;
};

/** Does this extension injectable belong in the given container? */
function isExtensionInjectableForEnv(injectable: InjectableInfo, type: ConsumerEnv): boolean {
  if (type === 'server' && injectable.isServerOnly) return true;
  if (type === 'client' && injectable.isClientOnly) return true;
  if (type === 'ssr' && injectable.isSsrOnly) return true;
  return !injectable.isClientOnly && !injectable.isServerOnly && !injectable.isSsrOnly;
}

/** Import specifier for an extension file, relative to the generated container. */
function toExtensionImportPath(outputFile: string, filePath: string): string {
  const relative = toPosix(path.relative(path.dirname(outputFile), filePath)).replace(/\.tsx?$/, '');
  return relative.startsWith('.') ? relative : `./${relative}`;
}

/** Extension injectables eligible for this container, paired with their owning extension. */
function collectExtensionCandidates(
  extensions: ExtensionInfo[],
  type: ConsumerEnv
): Array<{ ext: ExtensionInfo; injectable: InjectableInfo }> {
  const candidates: Array<{ ext: ExtensionInfo; injectable: InjectableInfo }> = [];
  for (const ext of extensions) {
    for (const injectable of ext.injectables) {
      if (isExtensionInjectableForEnv(injectable, type)) candidates.push({ ext, injectable });
    }
  }
  return candidates;
}

/**
 * Mirror the project-side rule: a file importing 'server-only' must never reach the client
 * container. A `Client` suffix on such a file is a source inconsistency worth warning about.
 */
function isBlockedFromClientContainer(
  ext: ExtensionInfo,
  injectable: InjectableInfo,
  type: ConsumerEnv
): boolean {
  if (type !== 'client' || !injectable.hasServerOnlyImport) return false;
  if (injectable.isClientOnly) {
    console.warn(
      `[DI] Excluding ${injectable.className} (extension '${ext.name}') from client container: file ${injectable.relativePath} imports 'server-only' despite the Client suffix.`,
    );
  }
  return true;
}

function buildExtensionImports(
  extensions: ExtensionInfo[],
  type: ConsumerEnv,
  outputFile: string,
  reachable?: Set<string>
): ExtensionImports {
  const candidates = collectExtensionCandidates(extensions, type);
  const importLines: string[] = [];
  const moduleNames: string[] = [];

  for (const { ext, injectable } of candidates) {
    if (reachable && !reachable.has(injectable.serviceId)) continue;
    if (isBlockedFromClientContainer(ext, injectable, type)) continue;

    const uniqueName = `ext_${ext.name.replaceAll(/\W/g, '_')}_${toModuleName(injectable.relativePath)}`;
    importLines.push(`import ${uniqueName} from '${toExtensionImportPath(outputFile, injectable.filePath)}';`);
    moduleNames.push(uniqueName);
  }

  return { importLines, moduleNames, kept: importLines.length, total: candidates.length };
}

/**
 * Alias map for one container: depency.yml + extension aliases + the DI_SEARCH_SERVICE
 * override (extension wins over depency.yml; the override wins over both).
 *
 * When pruning, only aliases a consumer actually requests are kept. Aliases whose target was
 * not shipped would degrade harmlessly anyway — the generated `if (container.isBound(target))`
 * guard skips them — but dropping them up front keeps the generated file lean.
 */
function resolveContainerAliases(
  extensionAliases: Record<string, string>,
  type: ConsumerEnv,
  extensionStats: { kept: number; total: number },
  reachable?: Set<string>
): Record<string, string> {
  const allAliases = resolveGeneratorAliases({
    dependencyAliases: tryParseDependencyAliases(),
    extensionAliases,
    searchServiceOverride: process.env.DI_SEARCH_SERVICE,
  });

  if (!reachable) return allAliases;

  const filtered: Record<string, string> = {};
  for (const [alias, target] of Object.entries(allAliases)) {
    if (reachable.has(alias)) filtered[alias] = target;
  }
  console.log(
    `[DI prune] ${type}: kept ${Object.keys(filtered).length}/${Object.keys(allAliases).length} alias binding(s); ` +
      `extensions ${extensionStats.kept}/${extensionStats.total}`
  );

  return filtered;
}

/**
 * Generates a single container file
 * @param layer The layer
 * @param injectables The injectable classes to include
 * @param outputFile The output file path
 * @param type The type of container (server or client)
 */
async function generateContainerFile(
  layer: Layer,
  injectables: InjectableInfo[],
  outputFile: string,
  type: ConsumerEnv,
  extensions: ExtensionInfo[] = [],
  aliases: Record<string, string> = {},
  reachable?: Set<string>,
): Promise<string> {
  const activeInjectables = prunePlatformInjectables(injectables, type, reachable);
  assertNoModuleNameCollisions(activeInjectables);

  const platformImports = activeInjectables.map(
    (injectable) => `import ${toModuleName(injectable.relativePath)} from './${injectable.relativePath}';`
  );
  const platformModuleNames = activeInjectables.map((injectable) => toModuleName(injectable.relativePath));

  const extensionImports = buildExtensionImports(extensions, type, outputFile, reachable);

  const allImports = [...platformImports, ...extensionImports.importLines].join('\n');
  const allModuleNames = [...platformModuleNames, ...extensionImports.moduleNames];
  const moduleArray = `const modules : any[] = [${allModuleNames.join(', ')}];`;

  const aliasBindings = generateAliasBindings(
    resolveContainerAliases(aliases, type, extensionImports, reachable),
    'Alias'
  );

  const templatePath = path.join(process.cwd(), 'scripts/templates/container.ts.tmpl');
  let template: string;
  try {
    template = fs.readFileSync(templatePath, 'utf8');
  } catch (error) {
    throw new Error(`Error reading template file ${templatePath}: ${error}`);
  }

  const output = template
    .replace('{{imports}}', allImports)
    .replace('{{moduleArray}}', moduleArray)
    .replace('{{aliasBindings}}', aliasBindings)
    .replace('{{layer}}', layer);

  fs.writeFileSync(outputFile, output);
  console.log(`Generated ${type} container file: ${outputFile}`);

  return output;
}

/**
 * Main function to generate all container files
 */
async function generateAllContainers() {
  await generateContainerFiles('platform');
}

/**
 * Watch for changes and regenerate containers
 */
function watchForChanges() {
  const layer = 'platform';
  const { directory, serverOutputFile, clientOutputFile, ssrOutputFile } = LAYER_CONFIGS[layer];
  
  // Watch both the platform directory and extensions directory
  const watchPaths = [directory];
  if (fs.existsSync(EXTENSIONS_DIR)) {
    watchPaths.push(EXTENSIONS_DIR);
  }
  console.log(`Setting up watcher for ${watchPaths.join(', ')}...`);
  
  // Watch for changes in the directories
  const watcher = chokidar.watch(watchPaths, {
    ignored: [
      '**/*.d.ts',
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      serverOutputFile,
      clientOutputFile,
      ssrOutputFile
    ],
    persistent: true,
    // Prevent firing events during initial scan
    ignoreInitial: true
  });
  
  // Wait for the initial scan to complete before setting up event handlers
  watcher.on('ready', () => {
    console.log('Initial scan complete. Watching for changes...');
    
    // Set up event handlers after initial scan
    watcher.on('change', async (filePath) => {
      console.log(`File changed: ${filePath}`);
      await generateContainerFiles(layer);
    });
    
    watcher.on('add', async (filePath) => {
      console.log(`File added: ${filePath}`);
      await generateContainerFiles(layer);
    });
    
    watcher.on('unlink', async (filePath) => {
      console.log(`File deleted: ${filePath}`);
      await generateContainerFiles(layer);
    });
  });
}

console.log('Watching for changes...');

// Parse command line arguments
const args = process.argv.slice(2);
const watchMode = args.includes('--watch');

// Run the generator
(async () => {
  await generateAllContainers();
  
  if (watchMode) {
    watchForChanges();
  }
})().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});


