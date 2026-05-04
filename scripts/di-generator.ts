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

/** When true (see .env.template): also emit `src/platform/client.ts` for browser Inversify. Default: off. */
function isClientContainerGenerationEnabled(): boolean {
  const raw = (process.env.NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
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
                hasServerOnlyImport
              });
              
              if (DEBUG) console.debug(`Found injectable class: ${className} (${serviceId}, ${scope}) in ${relativePath}`);
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

  // Build injectables for a specific environment
  const buildEnvironmentInjectables = (env: 'server' | 'client' | 'ssr') => {
    let envInjectables : InjectableInfo[];
    switch (env) {
      case 'server':
        envInjectables = injectables.filter(i => i.isServerOnly)
        break;
      case 'client':
        envInjectables = injectables.filter(i => i.isClientOnly)
        break;
      case 'ssr':
        envInjectables = injectables.filter(i => i.isSsrOnly)
        break;
      default:
        envInjectables = [] 
    }
    const isCommon = (injectable: InjectableInfo) =>
      !injectable.isClientOnly && !injectable.isServerOnly && !injectable.isSsrOnly;
    const isAlreadyInEnv = (i : InjectableInfo) => envInjectables.find((envI : InjectableInfo) => i.serviceId == envI.serviceId)
    // we reduce the injectables to those that are usable for all environments
    // and which are NOT present in the environment specific injectables
    const common = injectables.filter(isCommon).filter((i) => !isAlreadyInEnv(i))
    // then we return the combination of both
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
  
  await generateContainerFile(layer, buildEnvironmentInjectables('server'), serverOutputFile, 'server', extensions, aliases);
  await generateContainerFile(layer, buildEnvironmentInjectables('ssr'), ssrOutputFile, 'ssr', extensions, aliases);

  if (isClientContainerGenerationEnabled()) {
    await generateContainerFile(layer, buildEnvironmentInjectables('client'), clientOutputFile, 'client', extensions, aliases);
  } else if (fs.existsSync(clientOutputFile)) {
    fs.unlinkSync(clientOutputFile);
    console.log(
      `Removed client container file (NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT not enabled): ${clientOutputFile}`,
    );
  }
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
): Promise<string> {
  const dependencyAliases = tryParseDependencyAliases();

  const toModuleName = (relativePath: string): string =>
    path.basename(relativePath)
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '');

  // Fail fast if two injectables produce the same import identifier.
  const seenModuleNames = new Map<string, string>();
  for (const injectable of injectables) {
    const moduleName = toModuleName(injectable.relativePath);
    const prev = seenModuleNames.get(moduleName);
    if (prev) {
      throw new Error(
        `DI generator: import name collision "${moduleName}" between ` +
        `"${prev}" and "${injectable.relativePath}". ` +
        `Rename one of the files to avoid ambiguity.`,
      );
    }
    seenModuleNames.set(moduleName, injectable.relativePath);
  }

  const imports = injectables.map((injectable) => {
    const moduleName = toModuleName(injectable.relativePath);
    return `import ${moduleName} from './${injectable.relativePath}';`;
  }).join('\n');
  
  const moduleNames = injectables.map((injectable) => toModuleName(injectable.relativePath));

  // Generate extension imports and module names
  const extensionImportLines: string[] = [];
  const extensionModuleNames: string[] = [];

  for (const ext of extensions) {
    for (const extInjectable of ext.injectables) {
      // Determine environment filtering for extension injectables
      const isForEnv =
        (type === 'server' && extInjectable.isServerOnly) ||
        (type === 'client' && extInjectable.isClientOnly) ||
        (type === 'ssr' && extInjectable.isSsrOnly) ||
        (!extInjectable.isClientOnly && !extInjectable.isServerOnly && !extInjectable.isSsrOnly);

      if (!isForEnv) continue;

      // Mirror the project-side rule: never emit a 'server-only' file into the client container.
      if (type === 'client' && extInjectable.hasServerOnlyImport) {
        if (extInjectable.isClientOnly) {
          console.warn(
            `[DI] Excluding ${extInjectable.className} (extension '${ext.name}') from client container: file ${extInjectable.relativePath} imports 'server-only' despite the Client suffix.`,
          );
        }
        continue;
      }

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
  
  const allAliases = { ...dependencyAliasMap, ...aliases };
  
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
  

  let processedTemplate = template;
  if (type !== 'client') {
    processedTemplate = processedTemplate.replace(
      ' */\n\nimport { addInjectableModule }',
      " */\n\nimport 'server-only';\n\nimport { addInjectableModule }",
    );
  }

  const output = processedTemplate
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


