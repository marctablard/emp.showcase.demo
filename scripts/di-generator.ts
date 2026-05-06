#!/usr/bin/env ts-node
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
import * as ts from 'typescript';
import type { Decorator } from 'typescript';
import * as glob from 'glob';
import * as chokidar from 'chokidar';

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
  dependencies: string[];
}

/**
 * Scans TypeScript files for classes decorated with @injectable
 * @param directory The directory to scan
 * @returns An array of injectable class information
 */
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
      const sourceFile = ts.createSourceFile(
        filePath,
        fileContent,
        ts.ScriptTarget.Latest,
        true
      );
      
      // Find classes with @injectable decorator
      ts.forEachChild(sourceFile, (node) => {
        if (ts.isClassDeclaration(node) && node.name) {
          // Get decorators from modifiers
          const decorators: Decorator[] = [];
          if (node.modifiers) {
            node.modifiers.forEach(modifier => {
              if (modifier.kind === ts.SyntaxKind.Decorator) {
                decorators.push(modifier as Decorator);
              }
            });
          }
          
          if (decorators.length === 0) return;
          // find our injectable decorator
          const injectableDecorator = decorators.find((decorator) => {
            const decoratorName = decorator.expression.getText(sourceFile);
            return decoratorName.startsWith('injectable(') || decoratorName.startsWith('@injectable(');
          });
          
          if (injectableDecorator) {
            const decoratorText = injectableDecorator.expression.getText(sourceFile);
            const match = decoratorText.match(/injectable\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"]\)/);
            
            if (match) {
              const serviceId = match[1];
              const scope = match[2];
              const className = node.name.text;

              // Calculate relative path for import
              const relativePath = path.relative(directory, filePath)
                .replace(/\\/g, '/') // Convert Windows paths to Unix-style
                .replace(/\.tsx?$/, ''); // Remove file extension

              // Determine if this is a client-only or server-only injectable
              const isClientOnly = className.endsWith('Client');
              const isServerOnly = className.endsWith('Server');
              const isSsrOnly = className.endsWith('SSR');

              // Extract @inject('Id') dependencies from constructor parameters
              const dependencies: string[] = [];
              const ctor = node.members.find(
                (m): m is ts.ConstructorDeclaration => ts.isConstructorDeclaration(m)
              );
              if (ctor) {
                for (const param of ctor.parameters) {
                  if (!param.modifiers) continue;
                  for (const modifier of param.modifiers) {
                    if (modifier.kind !== ts.SyntaxKind.Decorator) continue;
                    const decoratorText = (modifier as Decorator).expression.getText(sourceFile);
                    const injectMatch = decoratorText.match(/inject\(\s*['"]([^'"]+)['"]\s*\)/);
                    if (injectMatch) dependencies.push(injectMatch[1]);
                  }
                }
              }

              // gather information about all injectables that we have
              injectables.push({
                className,
                serviceId,
                scope,
                filePath,
                relativePath,
                isClientOnly,
                isServerOnly,
                isSsrOnly,
                dependencies,
              });

              if (DEBUG) console.debug(`Found injectable class: ${className} (${serviceId}, ${scope}) in ${relativePath} -> deps: [${dependencies.join(', ')}]`);
            }
          }
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

const CONTAINER_FILE_PATHS: Record<ConsumerEnv, string> = {
  server: path.join(process.cwd(), 'src/platform/server.ts').replace(/\\/g, '/'),
  client: path.join(process.cwd(), 'src/platform/client.ts').replace(/\\/g, '/'),
  ssr: path.join(process.cwd(), 'src/platform/ssr.ts').replace(/\\/g, '/'),
};

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
  const normalized = resolved.replace(/\\/g, '/').replace(/\.(ts|tsx|js|jsx)$/, '');
  for (const env of Object.keys(CONTAINER_FILE_PATHS) as ConsumerEnv[]) {
    const target = CONTAINER_FILE_PATHS[env].replace(/\.(ts|tsx)$/, '');
    if (normalized === target) return env;
  }
  return null;
}

type ProxyInfo = { env: ConsumerEnv; idArgIndex: number };

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
  type Target =
    | { idArgIndex: number; via: { kind: 'container'; env: ConsumerEnv } }
    | { idArgIndex: number; via: { kind: 'proxy'; name: string } };
  type Candidate = { name: string; targets: Target[] };

  const candidates: Candidate[] = [];
  const interestingMethods = new Set(['get', 'getAll', 'isBound', 'bind', 'unbind']);

  const files = glob.sync('{src,extensions}/**/*.{ts,tsx}', {
    cwd: process.cwd(),
    ignore: ['**/*.d.ts', '**/node_modules/**', '**/dist/**', '**/build/**'],
    absolute: true,
  });
  const generatedContainerSet = new Set(Object.values(CONTAINER_FILE_PATHS));

  for (const filePath of files) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    if (generatedContainerSet.has(normalizedPath)) continue;
    let fileContent: string;
    try {
      fileContent = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    const sourceFile = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.Latest, true);

    // Build local container-binding map (so we know which identifiers are containers).
    const bindingToEnv = new Map<string, ConsumerEnv>();
    ts.forEachChild(sourceFile, (node) => {
      if (!ts.isImportDeclaration(node)) return;
      const moduleSpec = node.moduleSpecifier;
      if (!ts.isStringLiteral(moduleSpec)) return;
      const env = resolveImportToContainer(moduleSpec.text, filePath);
      if (!env) return;
      const ic = node.importClause;
      if (!ic) return;
      if (ic.name) bindingToEnv.set(ic.name.text, env);
      if (ic.namedBindings && ts.isNamespaceImport(ic.namedBindings)) {
        bindingToEnv.set(ic.namedBindings.name.text, env);
      }
    });

    const inspectFunction = (
      funcName: string,
      params: ts.NodeArray<ts.ParameterDeclaration>,
      body: ts.Node
    ) => {
      const paramNames = Array.from(params).map((p) =>
        ts.isIdentifier(p.name) ? p.name.text : null
      );
      if (!paramNames.some((n) => n !== null)) return;

      // Collect *every* call expression that forwards one of this function's params
      // as its first argument. We need all of them because the body may contain
      // unrelated forwards (e.g. useRef(initialData)) before the meaningful one.
      const targets: Target[] = [];
      const walkBody = (n: ts.Node): void => {
        if (ts.isCallExpression(n)) {
          const firstArg = n.arguments[0];
          if (firstArg && ts.isIdentifier(firstArg)) {
            const argIndex = paramNames.indexOf(firstArg.text);
            if (argIndex >= 0) {
              const callee = n.expression;
              if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
                const env = bindingToEnv.get(callee.expression.text);
                if (env && interestingMethods.has(callee.name.text)) {
                  targets.push({ idArgIndex: argIndex, via: { kind: 'container', env } });
                }
              } else if (ts.isIdentifier(callee)) {
                targets.push({ idArgIndex: argIndex, via: { kind: 'proxy', name: callee.text } });
              }
            }
          }
        }
        ts.forEachChild(n, walkBody);
      };
      walkBody(body);
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
  }

  // Iteratively resolve: a function is a proxy if any of its forwarding targets
  // resolves to a container chain (directly or through another known proxy). Iterate
  // until no progress is made; stranded candidates are silently dropped.
  const resolved = new Map<string, ProxyInfo>();
  let pending = candidates;
  let progress = true;
  while (progress) {
    progress = false;
    const remaining: Candidate[] = [];
    for (const c of pending) {
      if (resolved.has(c.name)) continue;
      let resolvedHere: ProxyInfo | null = null;
      for (const t of c.targets) {
        if (t.via.kind === 'container') {
          resolvedHere = { env: t.via.env, idArgIndex: t.idArgIndex };
          break;
        }
        const dep = resolved.get(t.via.name);
        if (dep) {
          resolvedHere = { env: dep.env, idArgIndex: t.idArgIndex };
          break;
        }
      }
      if (resolvedHere) {
        resolved.set(c.name, resolvedHere);
        progress = true;
      } else {
        remaining.push(c);
      }
    }
    pending = remaining;
  }

  if (DEBUG && resolved.size > 0) {
    console.debug(
      '[DI prune debug] detected proxies:',
      Array.from(resolved.entries()).map(([n, i]) => `${n}->${i.env}[${i.idArgIndex}]`)
    );
  }

  return resolved;
}

/**
 * Walks all source files in src/ and extensions/ looking for consumer-side container
 * lookups (container.get, getAll, bind, unbind, isBound). Returns the set of service IDs
 * referenced per environment. Per the build-size optimization plan, isBound is treated
 * as a hard reference so feature-detection paths (e.g. CMS live editor) survive pruning.
 *
 * If a `proxies` map is provided, calls to known proxy functions (e.g. `useValidator(...)`)
 * are also treated as seeds, attributed to the proxy's home env.
 */
async function scanConsumers(
  proxies: Map<string, ProxyInfo> = new Map()
): Promise<Record<ConsumerEnv, Set<string>>> {
  const result: Record<ConsumerEnv, Set<string>> = {
    server: new Set<string>(),
    client: new Set<string>(),
    ssr: new Set<string>(),
  };

  const files = glob.sync('{src,extensions}/**/*.{ts,tsx}', {
    cwd: process.cwd(),
    ignore: ['**/*.d.ts', '**/node_modules/**', '**/dist/**', '**/build/**'],
    absolute: true,
  });

  const generatedContainerSet = new Set(Object.values(CONTAINER_FILE_PATHS));
  const interestingMethods = new Set(['get', 'getAll', 'isBound', 'bind', 'unbind']);

  for (const filePath of files) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    if (generatedContainerSet.has(normalizedPath)) continue;

    let fileContent: string;
    try {
      fileContent = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    // Cheap prefilter: skip files that mention neither a container nor any known proxy.
    const mentionsContainer =
      fileContent.includes('platform/server') ||
      fileContent.includes('platform/client') ||
      fileContent.includes('platform/ssr');
    let mentionsProxy = false;
    if (!mentionsContainer && proxies.size > 0) {
      for (const proxyName of proxies.keys()) {
        if (fileContent.includes(proxyName)) {
          mentionsProxy = true;
          break;
        }
      }
    }
    if (!mentionsContainer && !mentionsProxy) continue;

    const sourceFile = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.Latest, true);

    const bindingToEnv = new Map<string, ConsumerEnv>();
    ts.forEachChild(sourceFile, (node) => {
      if (!ts.isImportDeclaration(node)) return;
      const moduleSpec = node.moduleSpecifier;
      if (!ts.isStringLiteral(moduleSpec)) return;
      const env = resolveImportToContainer(moduleSpec.text, filePath);
      if (!env) return;
      const importClause = node.importClause;
      if (!importClause) return;
      if (importClause.name) {
        bindingToEnv.set(importClause.name.text, env);
      }
      if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
        bindingToEnv.set(importClause.namedBindings.name.text, env);
      }
    });

    // Walks up parent links from `node` to find the nearest enclosing named function.
    // Used to suppress warnings when a non-literal lookup lives inside a known proxy —
    // the literal will be picked up at the proxy's call sites.
    const findEnclosingFunctionName = (node: ts.Node): string | undefined => {
      let current: ts.Node | undefined = node.parent;
      while (current) {
        if (ts.isFunctionDeclaration(current) && current.name) {
          return current.name.text;
        }
        if ((ts.isArrowFunction(current) || ts.isFunctionExpression(current)) && current.parent) {
          const p = current.parent;
          if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) {
            return p.name.text;
          }
        }
        current = current.parent;
      }
      return undefined;
    };

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const expr = node.expression;

        // Direct container method call: <bind>.<method>('Id', ...)
        if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
          const targetName = expr.expression.text;
          const methodName = expr.name.text;
          const env = bindingToEnv.get(targetName);
          if (env && interestingMethods.has(methodName)) {
            const firstArg = node.arguments[0];
            if (firstArg && ts.isStringLiteral(firstArg)) {
              result[env].add(firstArg.text);
            } else if (firstArg) {
              const enclosing = findEnclosingFunctionName(node);
              if (!enclosing || !proxies.has(enclosing)) {
                const { line } = sourceFile.getLineAndCharacterOfPosition(firstArg.getStart(sourceFile));
                console.warn(
                  `[DI prune] Non-literal argument to ${targetName}.${methodName}() at ${path
                    .relative(process.cwd(), filePath)
                    .replace(/\\/g, '/')}:${line + 1} — pruner cannot trace this lookup.`
                );
              }
            }
          }
        }

        // Known-proxy call: <proxyName>('Id', ...) where the proxy was detected upstream.
        if (ts.isIdentifier(expr)) {
          const proxy = proxies.get(expr.text);
          if (proxy) {
            const idArg = node.arguments[proxy.idArgIndex];
            if (idArg && ts.isStringLiteral(idArg)) {
              result[proxy.env].add(idArg.text);
            } else if (idArg) {
              const enclosing = findEnclosingFunctionName(node);
              if (!enclosing || !proxies.has(enclosing)) {
                const { line } = sourceFile.getLineAndCharacterOfPosition(idArg.getStart(sourceFile));
                console.warn(
                  `[DI prune] Non-literal argument[${proxy.idArgIndex}] to proxy ${expr.text}() at ${path
                    .relative(process.cwd(), filePath)
                    .replace(/\\/g, '/')}:${line + 1} — pruner cannot trace this lookup.`
                );
              }
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sourceFile, visit);
  }

  return result;
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

  // Build injectables for a specific environment, env-aware: env-suffixed variants
  // (e.g. PinoLoggerServiceServer) shadow common ones with the same serviceId.
  const buildEnvironmentInjectables = (env: ConsumerEnv, list: InjectableInfo[] = injectables) => {
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
    return common.concat(envInjectables);
  };

  // When pruning is enabled, compute the reachable set per environment by walking the
  // dependency graph from real consumer-side container.get/isBound/etc. call sites.
  let reachableByEnv: Record<ConsumerEnv, Set<string>> | null = null;
  if (PRUNE) {
    console.log('[DI prune] Pruning enabled — detecting proxies + scanning consumer call sites...');
    const proxies = await detectProxies();
    if (proxies.size > 0) {
      console.log(`[DI prune] detected ${proxies.size} proxy function(s)`);
    }
    const consumers = await scanConsumers(proxies);

    // AlwaysInclude allowlist for IDs that the static analyzer cannot trace
    // (typically env-var-sourced lookups like setup/route.ts).
    const alwaysInclude = tryParseAlwaysInclude();
    for (const env of ['server', 'client', 'ssr'] as ConsumerEnv[]) {
      for (const id of alwaysInclude[env]) consumers[env].add(id);
    }
    const alwaysCount = alwaysInclude.server.length + alwaysInclude.client.length + alwaysInclude.ssr.length;
    if (alwaysCount > 0) {
      console.log(
        `[DI prune] AlwaysInclude — server:${alwaysInclude.server.length} client:${alwaysInclude.client.length} ssr:${alwaysInclude.ssr.length}`
      );
    }

    // Merged alias map (depency.yml + extension aliases). Extension wins on collision —
    // this matches the existing precedence inside generateContainerFile.
    const dependencyAliasList = tryParseDependencyAliases();
    const dependencyAliasMap: Record<string, string> = {};
    for (const { alias, target } of dependencyAliasList) dependencyAliasMap[alias] = target;
    const mergedAliases = { ...dependencyAliasMap, ...aliases };

    const combined = injectables.concat(extensionInjectables);
    reachableByEnv = {
      server: computeReachable(consumers.server, buildEnvironmentInjectables('server', combined), mergedAliases),
      client: computeReachable(consumers.client, buildEnvironmentInjectables('client', combined), mergedAliases),
      ssr: computeReachable(consumers.ssr, buildEnvironmentInjectables('ssr', combined), mergedAliases),
    };
    console.log(
      `[DI prune] consumer seeds — server:${consumers.server.size} client:${consumers.client.size} ssr:${consumers.ssr.size}`
    );
    console.log(
      `[DI prune] reachable set — server:${reachableByEnv.server.size} client:${reachableByEnv.client.size} ssr:${reachableByEnv.ssr.size}`
    );
    if (DEBUG) {
      console.debug('[DI prune debug] server seeds:', Array.from(consumers.server));
      console.debug('[DI prune debug] client seeds:', Array.from(consumers.client));
      console.debug('[DI prune debug] ssr seeds:', Array.from(consumers.ssr));
    }
  }

  await generateContainerFile(layer, buildEnvironmentInjectables('server'), serverOutputFile, 'server', extensions, aliases, reachableByEnv?.server);
  await generateContainerFile(layer, buildEnvironmentInjectables('client'), clientOutputFile, 'client', extensions, aliases, reachableByEnv?.client);
  await generateContainerFile(layer, buildEnvironmentInjectables('ssr'), ssrOutputFile, 'ssr', extensions, aliases, reachableByEnv?.ssr);
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
  type: 'server' | 'client' | 'ssr',
  extensions: ExtensionInfo[] = [],
  aliases: Record<string, string> = {},
  reachable?: Set<string>,
): Promise<string> {
  // Generate static imports for all platform injectables
  const dependencyAliases = tryParseDependencyAliases();

  // Pruning pass: when a reachable set is provided, drop platform injectables that
  // aren't transitively required by any consumer call site in this environment.
  let activeInjectables = injectables;
  if (reachable) {
    const beforePlatform = activeInjectables.length;
    activeInjectables = activeInjectables.filter((i) => reachable.has(i.serviceId));
    console.log(
      `[DI prune] ${type}: kept ${activeInjectables.length}/${beforePlatform} platform injectable(s)`
    );
  }

  // Generate static imports for all injectables
  const imports = activeInjectables.map((injectable) => {
    // Create a module name from the file path
    const moduleName = path.basename(injectable.relativePath)
      .replace(/[^a-zA-Z0-9_]/g, '_') // Replace non-alphanumeric chars with underscore
      .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores

    return `import ${moduleName} from './${injectable.relativePath}';`;
  }).join('\n');

  // Create an array of module names for platform injectables
  const moduleNames = activeInjectables.map((injectable) => {
    return path.basename(injectable.relativePath)
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '');
  });

  // Generate extension imports and module names
  const extensionImportLines: string[] = [];
  const extensionModuleNames: string[] = [];

  let extensionKept = 0;
  let extensionTotal = 0;
  for (const ext of extensions) {
    for (const extInjectable of ext.injectables) {
      // Determine environment filtering for extension injectables
      const isForEnv =
        (type === 'server' && extInjectable.isServerOnly) ||
        (type === 'client' && extInjectable.isClientOnly) ||
        (type === 'ssr' && extInjectable.isSsrOnly) ||
        (!extInjectable.isClientOnly && !extInjectable.isServerOnly && !extInjectable.isSsrOnly);

      if (!isForEnv) continue;
      extensionTotal++;
      if (reachable && !reachable.has(extInjectable.serviceId)) continue;
      extensionKept++;

      // Build a unique module name prefixed by extension name
      const baseName = path.basename(extInjectable.relativePath)
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/^_+|_+$/g, '');
      const uniqueName = `ext_${ext.name.replace(/[^a-zA-Z0-9_]/g, '_')}_${baseName}`;

      // Build the import path relative to the output file
      const outputDir = path.dirname(outputFile);
      let relImportPath = path.relative(outputDir, extInjectable.filePath)
        .replace(/\\/g, '/')
        .replace(/\.tsx?$/, '');
      if (!relImportPath.startsWith('.')) {
        relImportPath = './' + relImportPath;
      }

      extensionImportLines.push(`import ${uniqueName} from '${relImportPath}';`);
      extensionModuleNames.push(uniqueName);
    }
  }

  // Combine all imports
  const allImports = [imports, ...extensionImportLines].filter(Boolean).join('\n');

  // Combine all module names
  const allModuleNames = [...moduleNames, ...extensionModuleNames];
  
  // Generate the module array string
  const moduleArray = `const modules : any[] = [${allModuleNames.join(', ')}];`;

  /**
   * Helper function to generate alias binding code.
   * Checks if target is bound before creating the alias.
   */
  function generateAliasBindings(aliasMap: Record<string, string>, comment: string): string {
    const entries = Object.entries(aliasMap);
    if (entries.length === 0) return '';

    const aliasLines = entries.map(([alias, target]) => {
      // Skip if alias === target (no-op)
      if (alias === target) return null;

      return [
        `  // ${comment}: ${alias} -> ${target}`,
        `  if (container.isBound('${target}')) {`,
        `    if (container.isBound('${alias}')) {`,
        `      container.unbind('${alias}');`,
        `    }`,
        `    container.bind('${alias}').toService('${target}');`,
        `  }`,
      ].join('\n');
    }).filter(Boolean);

    return aliasLines.length > 0 ? '\n' + aliasLines.join('\n\n') + '\n' : '';
  }

  // Combine extension aliases and dependency aliases into a single map
  const dependencyAliasMap = dependencyAliases.reduce((acc, { alias, target }) => {
    acc[alias] = target;
    return acc;
  }, {} as Record<string, string>);
  
  let allAliases: Record<string, string> = { ...dependencyAliasMap, ...aliases };

  // When pruning, retain only aliases consumers actually request (alias key in reachable).
  // Aliases whose target wasn't shipped degrade naturally — the generated guard
  // `if (container.isBound(target))` skips them — but dropping them up front keeps
  // the generated file lean.
  if (reachable) {
    const beforeAliases = Object.keys(allAliases).length;
    const filtered: Record<string, string> = {};
    for (const [alias, target] of Object.entries(allAliases)) {
      if (reachable.has(alias)) filtered[alias] = target;
    }
    allAliases = filtered;
    console.log(
      `[DI prune] ${type}: kept ${Object.keys(allAliases).length}/${beforeAliases} alias binding(s); ` +
        `extensions ${extensionKept}/${extensionTotal}`
    );
  }

  // Generate all alias bindings using the helper function
  const aliasBindings = generateAliasBindings(allAliases, 'Alias');
  
  // Read the template file
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
  
  // Write the output file
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


