#!/usr/bin/env ts-node
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
import * as ts from 'typescript';
import type { Node, ClassDeclaration, Decorator } from 'typescript';
import * as glob from 'glob';
import * as chokidar from 'chokidar';
import { baseUrl } from '../src/lib/utils';

// Configuration
const DEBUG = process.env.DEBUG === 'true';

// Define the layers we support
type Layer = 'integration' | 'service' | 'repository' | 'platform';

// Configuration for each layer
const LAYER_CONFIGS: Record<Layer, { directory: string; serverOutputFile: string; clientOutputFile: string, ssrOutputFile: string }> = {
  integration: {
    directory: path.join(process.cwd(), 'src/platform/integrations'),
    ssrOutputFile: path.join(process.cwd(), 'src/platform/integrations/ssr.ts'),
    serverOutputFile: path.join(process.cwd(), 'src/platform/integrations/server.ts'),
    clientOutputFile: path.join(process.cwd(), 'src/platform/integrations/client.ts'),
  },
  service: {
    directory: path.join(process.cwd(), 'src/platform/services'),
    ssrOutputFile: path.join(process.cwd(), 'src/platform/services/ssr.ts'),
    serverOutputFile: path.join(process.cwd(), 'src/platform/services/server.ts'),
    clientOutputFile: path.join(process.cwd(), 'src/platform/services/client.ts'),
  },
  repository: {
    directory: path.join(process.cwd(), 'src/platform/repositories'),
    ssrOutputFile: path.join(process.cwd(), 'src/platform/repositories/ssr.ts'),
    serverOutputFile: path.join(process.cwd(), 'src/platform/repositories/server.ts'),
    clientOutputFile: path.join(process.cwd(), 'src/platform/repositories/client.ts'),
  },
  platform: {
    directory: path.join(process.cwd(), 'src/platform'),
    ssrOutputFile: path.join(process.cwd(), 'src/platform/ssr.ts'),
    serverOutputFile: path.join(process.cwd(), 'src/platform/server.ts'),
    clientOutputFile: path.join(process.cwd(), 'src/platform/client.ts'),
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
              
              // gather information about all injectables that we have
              injectables.push({
                className,
                serviceId,
                scope,
                filePath,
                relativePath,
                isClientOnly,
                isServerOnly,
                isSsrOnly
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
 * Generates the container files with static imports
 * @param layer The layer for which to generate the container
 */
async function generateContainerFiles(layer: Layer): Promise<void> {
  const { directory, serverOutputFile, clientOutputFile, ssrOutputFile } = LAYER_CONFIGS[layer];
  if (DEBUG) console.debug(`Scanning ${layer} layer in directory: ${directory}`);
  
  // Scan for injectables in this specific directory
  const injectables = (await scanForInjectables(directory)).filter(injectable => injectable.className !== 'default');
  if (DEBUG) console.info(`Found ${injectables.length} injectable classes for ${layer} layer`);

  // Build injectables for a specific environment
  const buildEnvironmentInjectables = (env : 'server' | 'client' | 'ssr') => {
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
    const isCommon = (injectable : InjectableInfo) => !injectable.isClientOnly && !injectable.isServerOnly && !injectable.isSsrOnly;
    const isAlreadyInEnv = (i : InjectableInfo) => envInjectables.find((envI : InjectableInfo) => i.serviceId == envI.serviceId)
    // we reduce the injectables to those that are usable for all environments
    // and which are NOT present in the environment specific injectables
    const common = injectables.filter(isCommon).filter((i) => !isAlreadyInEnv(i))
    // then we return the combination of both
    return common.concat(envInjectables);
  }
  
  await generateContainerFile(layer,  buildEnvironmentInjectables('server'), serverOutputFile, 'server');
  await generateContainerFile(layer, buildEnvironmentInjectables('client'), clientOutputFile, 'client');
  await generateContainerFile(layer,  buildEnvironmentInjectables('ssr'), ssrOutputFile, 'ssr');
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
  type: 'server' | 'client' | 'ssr'
): Promise<string> {
  // Generate static imports for all injectables
  const imports = injectables.map((injectable) => {
    // Create a module name from the file path
    const moduleName = path.basename(injectable.relativePath)
      .replace(/[^a-zA-Z0-9_]/g, '_') // Replace non-alphanumeric chars with underscore
      .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
    
    return `import ${moduleName} from './${injectable.relativePath}';`;
  }).join('\n');
  
  // Create an array of module names
  const moduleNames = injectables.map((injectable) => {
    return path.basename(injectable.relativePath)
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '');
  });
  
  // Generate the module array string
  const moduleArray = `const modules : any[] = [${moduleNames.join(', ')}];`;
  
  // Read the template file
  const templatePath = path.join(process.cwd(), 'scripts/templates/container.ts.tmpl');
  let template: string;
  
  try {
    template = fs.readFileSync(templatePath, 'utf8');
  } catch (error) {
    console.error(`Error reading template file ${templatePath}:`, error);
    // Create a basic template if the file doesn't exist
    template = `/**
 * THIS FILE IS AUTO-GENERATED - DO NOT EDIT DIRECTLY
 * -----------------------------------------------
 * Generated by the DI generator script.
 * 
 * To add new injectable classes, use the @injectable decorator from src/platform/common/di/injectable.ts
 * Example: @injectable('MyServiceId', 'Singleton')
 * 
 * Run 'npm run generate-di' to regenerate this file after adding new injectable classes.
 */

import { registerModule } from '../core/di/registry';
import getContainer from '../core/di/registry';
import { Container } from 'inversify';

// Static imports
{{imports}}

// Array of all modules
{{moduleArray}}

/**
 * Initialize the container with all modules
 */
export function initializeContainer(): Container {
  // Register all modules
  modules.forEach(module => {
    registerModule(module);
  });
  
  return getContainer();
}

// Initialize the container
const container = initializeContainer();

// Export the container
export default container;
`;
  }
  
  // Replace placeholders in the template
  const output = template
    .replace('{{imports}}', imports)
    .replace('{{moduleArray}}', moduleArray)
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
  
  console.log(`Setting up watcher for ${directory}...`);
  
  // Watch for changes in the directory
  const watcher = chokidar.watch(directory, {
    ignored: ['**/*.d.ts', '**/node_modules/**', '**/dist/**', '**/build/**', serverOutputFile, clientOutputFile, ssrOutputFile],
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


