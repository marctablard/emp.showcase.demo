import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { globSync } from 'glob';
import type { Layer } from './types'

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

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const yaml = require('js-yaml');
    const raw = fs.readFileSync(dependencyFilePath, 'utf8');
    const parsed = (yaml.load(raw) || {}) as DependencyAliasConfig;

    const sections: Array<keyof DependencyAliasConfig> = ['Services', 'Integrations', 'Repositories'];
    const aliases: Array<{ alias: string; target: string }> = [];

    for (const section of sections) {
      const entries = parsed[section];

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
const ID_KEY = 'emp_inversify:id';

const DEBUG = false;

// Define the layer configurations
export const LAYER_CONFIGS: Record<Layer, { directory: string, outputFile: string }> = {
  integration: {
    directory: 'src/platform/integrations',
    outputFile: 'src/platform/integrations/index.ts'
  },
  service: {
    directory: 'src/platform/services',
    outputFile: 'src/platform/services/index.ts'
  },
  repository: {
    directory: 'src/platform/repositories',
    outputFile: 'src/platform/repositories/index.ts'
  }
};

interface InjectableInfo {
  filePath: string;
  className: string;
  id: string | symbol;
  interfaceName?: string;
  isClientOnly: boolean;
  isServerOnly: boolean;
  module: any;
}

/**
 * Dynamically imports a module
 */
export async function importModule(modulePath: string): Promise<any> {
  try {
    // Convert file path to module path
    const fullPath = path.resolve(modulePath);
    
    if (DEBUG) console.debug(`Trying to import: ${fullPath}`);
    
    // For now, let's use a simpler approach - we'll just check if the file exists
    // and return a mock module for testing purposes
    if (fs.existsSync(fullPath)) {
      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      
      // Extract class information using regex
      // Look for @injectable decorator
      const decoratorRegex = /@injectable\(['"]([^'"]+)['"](?:,\s*['"]([^'"]+)['"])?\)/g;
      const classRegex = /class\s+(\w+)(?:\s+implements\s+(\w+))?/g;
      
      // Create a mock module with the extracted classes
      const mockModule: Record<string, any> = {};
      
      // Find all injectable decorators
      let decoratorMatch;
      while ((decoratorMatch = decoratorRegex.exec(fileContent)) !== null) {
        const decoratorLine = decoratorMatch[0];
        const id = decoratorMatch[1];
        const scope = decoratorMatch[2] || 'Transient';
        
        if (DEBUG) console.debug(`Found injectable decorator: ${decoratorLine} with ID: ${id}, scope: ${scope}`);
        
        // Find the class declaration that follows the decorator
        const classDeclarationStart = decoratorMatch.index + decoratorLine.length;
        const classText = fileContent.substring(classDeclarationStart, classDeclarationStart + 200);
        
        // Extract class name and implemented interface
        const classMatch = classRegex.exec(classText);
        if (classMatch) {
          const className = classMatch[1];
          const interfaceName = classMatch[2];
          
          if (DEBUG) console.debug(`Found class ${className}${interfaceName ? ` implementing ${interfaceName}` : ''}`);
          
          // Create a mock class with metadata
          const MockClass = function() {};
          Reflect.defineMetadata('emp_inversify:id', id, MockClass);
          
          // Add the class to the mock module
          mockModule[className] = MockClass;
          
          // If this is a default export, also add it as default
          if (fileContent.includes(`export default ${className}`)) {
            mockModule.default = MockClass;
          }
          
          if (DEBUG) console.debug(`Added class ${className} with ID ${id} to mock module`);
        }
      }
      
      return mockModule;
    }
    
    return null;
  } catch (error) {
    console.error(`Error processing module ${modulePath}:`, error);
    return null;
  }
}

/**
 * Scans for classes with injectable decorators using reflection in a specific directory
 */
async function scanForInjectables(directory?: string): Promise<InjectableInfo[]> {
  const injectables: InjectableInfo[] = [];
  
  // Get all TypeScript files in the specified directory or directories
  const files: string[] = [];
  
  if (directory) {
    // Scan a specific directory
    const fullPath = path.join(process.cwd(), directory);
    if (fs.existsSync(fullPath)) {
      const pattern = path.join(directory, '**/*.ts').replace(/\\/g, '/');
      const matches = globSync(pattern);
      if (DEBUG) console.debug(`Scanning directory: ${directory}, found ${matches.length} files`);
      files.push(...matches);
    } else {
      if (DEBUG) console.debug(`Directory does not exist: ${fullPath}`);
    }
  } else {
    // Scan all configured directories if no specific directory is provided
    for (const layer of Object.keys(LAYER_CONFIGS) as Layer[]) {
      const dir = LAYER_CONFIGS[layer].directory;
      const fullPath = path.join(process.cwd(), dir);
      if (fs.existsSync(fullPath)) {
        const pattern = path.join(dir, '**/*.ts').replace(/\\/g, '/');
        const matches = globSync(pattern);
        if (DEBUG) console.debug(`Scanning directory: ${dir}, found ${matches.length} files`);
        files.push(...matches);
      } else {
        if (DEBUG) console.debug(`Directory does not exist: ${fullPath}`);
      }
    }
  }
  
  if (DEBUG) console.debug(`Found ${files.length} TypeScript files to scan`);
  
  // Process each file
  for (const file of files) {
    // Skip declaration files and test files
    if (file.endsWith('.d.ts') || file.includes('.test.') || file.includes('.spec.')) {
      continue;
    }
    
    // Check if the file contains an injectable decorator
    const fileContent = fs.readFileSync(file, 'utf-8');
    if (fileContent.includes('@injectable')) {
      if (DEBUG) console.debug(`Found potential injectable in: ${file}`);
      
      // Import the module
      const module = await importModule(file);
      if (!module) continue;
      
      // Check all exports for injectable classes
      for (const exportName in module) {
        const exportedItem = module[exportName];
        
        // Check if it's a class and has injectable metadata
        const metadataKeys = Reflect.getMetadataKeys(exportedItem);
        if (typeof exportedItem === 'function' && metadataKeys.includes(ID_KEY)) {
          // Get the identifier for the class using our helper function
          const id = Reflect.getMetadata(ID_KEY, exportedItem);
          
          // Determine if this is client-only or server-only
          const isClientOnly = file.includes('Client.ts') || fileContent.includes('typeof window !== "undefined"');
          const isServerOnly = file.includes('Server.ts') || fileContent.includes('typeof window === "undefined"');
          
          // Extract interface name if available
          const interfaceMatch = fileContent.match(/class\s+(\w+)\s+implements\s+(\w+)/);
          const interfaceName = interfaceMatch ? interfaceMatch[2] : undefined;
          
          injectables.push({
            filePath: file,
            className: exportName,
            id,
            interfaceName,
            isClientOnly,
            isServerOnly,
            module
          });
          
          if (DEBUG) console.debug(`Found injectable class: ${exportName} with ID: ${id}`);
          if (interfaceName && DEBUG) console.debug(`Found interface: ${interfaceName} for class ${exportName}`);
        }
      }
    }
  }
  
  return injectables;
}

/**
 * Generates the container file that uses registerModule and getContainer
 * @param injectables The injectable classes to include in the container
 * @param layer The layer for which to generate the container (integration, service, etc.)
 */
export async function generateContainerFile(layer: Layer): Promise<string> {
  const { directory, outputFile } = LAYER_CONFIGS[layer];
  if (DEBUG) console.debug(`Scanning ${layer} layer in directory: ${directory}`);

  const dependencyAliases = tryParseDependencyAliases();
  
  // Scan for injectables in this specific directory
  const injectables = await scanForInjectables(directory);
  if (DEBUG) console.info(`Found ${injectables.length} injectable classes for ${layer} layer`);

  // Group injectables by client/server/common
  const serverInjectables: InjectableInfo[] = [];
  const clientInjectables: InjectableInfo[] = [];
  const commonInjectables: InjectableInfo[] = [];
  
  // Track unique file paths to avoid duplicates
  const serverPaths = new Set<string>();
  const clientPaths = new Set<string>();
  const commonPaths = new Set<string>();
  
  // Sort injectables into groups
  for (const injectable of injectables) {
    // Skip default exports as they're duplicates of named exports
    if (injectable.className === 'default') continue;
    
    if (injectable.isServerOnly) {
      // Only add if not already in the set
      if (!serverPaths.has(injectable.filePath)) {
        serverInjectables.push(injectable);
        serverPaths.add(injectable.filePath);
      }
    } else if (injectable.isClientOnly) {
      if (!clientPaths.has(injectable.filePath)) {
        clientInjectables.push(injectable);
        clientPaths.add(injectable.filePath);
      }
    } else {
      if (!commonPaths.has(injectable.filePath)) {
        commonInjectables.push(injectable);
        commonPaths.add(injectable.filePath);
      }
    }
  }
  
  // Read the template file
  const templatePath = path.join(process.cwd(), 'scripts/templates/container.ts.tmpl');
  let templateContent = fs.readFileSync(templatePath, 'utf-8');
  
  // Fix the import paths for the registry based on the layer
  let registryImportPath = './common/di/registry';
  if (layer === 'integration' || layer === 'service' || layer === 'repository') {
    // For layer-specific containers, we need to adjust the path to the registry
    registryImportPath = '../common/di/registry';
  }
  
  // Replace the registry import path
  templateContent = templateContent.replace(/from '\.\/common\/di\/registry'/g, `from '${registryImportPath}'`);
  
  // Add documentation header
  const docHeader = `/**
 * THIS FILE IS AUTO-GENERATED - DO NOT EDIT DIRECTLY
 * -----------------------------------------------
 * Generated by the DI generator script.
 * 
 * To add new injectable classes, use the @injectable decorator from src/platform/common/di/injectable.ts
 * Example: @injectable('MyServiceId', 'Singleton')
 * 
 * Run 'npm run generate-di' to regenerate this file after adding new injectable classes.
 */

`;
  
  templateContent = docHeader + templateContent;
  
  // Generate server modules string
  let serverModulesStr = '';
  if (serverInjectables.length > 0) {
    for (const injectable of serverInjectables) {
      // Format the path correctly for import based on the layer
      // For layer-specific containers, we need to adjust the paths to be relative to the layer directory
      let importPath = injectable.filePath.replace(/\.ts$/, '').replace(/\\/g, '/');
      
      // Remove the src/platform prefix
      importPath = importPath.replace(/^src\/platform\//, '');
      
      // For layer-specific containers, remove the layer prefix from the path
      if (layer === 'integration') {
        importPath = importPath.replace(/^integrations\//, '');
      } else if (layer === 'service') {
        importPath = importPath.replace(/^services\//, '');
      } else if (layer === 'repository') {
        importPath = importPath.replace(/^repositories\//, '');
      }
      
      // Add the ./ prefix for relative import
      importPath = `./${importPath}`;
      
      serverModulesStr += `      await import('${importPath}'),\n`;
    }
  } else {
    serverModulesStr = '      // No server-side modules to register';
  }
  
  // Generate client modules string
  let clientModulesStr = '';
  if (clientInjectables.length > 0) {
    for (const injectable of clientInjectables) {
      // Format the path correctly for import based on the layer
      // For layer-specific containers, we need to adjust the paths to be relative to the layer directory
      let importPath = injectable.filePath.replace(/\.ts$/, '').replace(/\\/g, '/');
      
      // Remove the src/platform prefix
      importPath = importPath.replace(/^src\/platform\//, '');
      
      // For layer-specific containers, remove the layer prefix from the path
      if (layer === 'integration') {
        importPath = importPath.replace(/^integrations\//, '');
      } else if (layer === 'service') {
        importPath = importPath.replace(/^services\//, '');
      } else if (layer === 'repository') {
        importPath = importPath.replace(/^repositories\//, '');
      }
      
      // Add the ./ prefix for relative import
      importPath = `./${importPath}`;
      
      clientModulesStr += `      await import('${importPath}'),\n`;
    }
  } else {
    clientModulesStr = '      // No client-side modules to register';
  }
  
  // Generate common modules string
  let commonModulesStr = '';
  if (commonInjectables.length > 0) {
    for (const injectable of commonInjectables) {
      // Format the path correctly for import based on the layer
      // For layer-specific containers, we need to adjust the paths to be relative to the layer directory
      let importPath = injectable.filePath.replace(/\.ts$/, '').replace(/\\/g, '/');
      
      // Remove the src/platform prefix
      importPath = importPath.replace(/^src\/platform\//, '');
      
      // For layer-specific containers, remove the layer prefix from the path
      if (layer === 'integration') {
        importPath = importPath.replace(/^integrations\//, '');
      } else if (layer === 'service') {
        importPath = importPath.replace(/^services\//, '');
      } else if (layer === 'repository') {
        importPath = importPath.replace(/^repositories\//, '');
      }
      
      // Add the ./ prefix for relative import
      importPath = `./${importPath}`;
      
      commonModulesStr += `    await import('${importPath}'),\n`;
    }
  } else {
    commonModulesStr = '    // No common modules to register';
  }
  
  // Replace placeholders in the template
  templateContent = templateContent.replace('{{SERVER_MODULES}}', serverModulesStr);
  templateContent = templateContent.replace('{{CLIENT_MODULES}}', clientModulesStr);
  templateContent = templateContent.replace('{{COMMON_MODULES}}', commonModulesStr);

  const aliasBindings = (() => {
    if (!dependencyAliases.length) return '';

    const lines: string[] = [];
    lines.push('// Dependency aliases from src/platform/depency.yml');

    for (const { alias, target } of dependencyAliases) {
      if (alias === target) continue;
      lines.push(`if (!container.isBound('${target}')) {`);
      lines.push(`  diLogger.warn('[DI] Alias target not bound: ${target} (for alias: ${alias})');`);
      lines.push('} else {');
      lines.push(`  if (container.isBound('${alias}')) {`);
      lines.push(`    container.unbind('${alias}');`);
      lines.push('  }');
      lines.push(`  container.bind('${alias}').toService('${target}');`);
      lines.push('}');
    }

    return lines.map((l) => `  ${l}`).join('\n');
  })();

  templateContent = templateContent.replace('{{aliasBindings}}', aliasBindings);
  
  // Make sure to replace all instances of the LAYER placeholder
  while (templateContent.includes('{{LAYER}}')) {
    templateContent = templateContent.replace('{{LAYER}}', layer);
  }
  
  // Ensure directory exists
  const outputPath = path.join(process.cwd(), outputFile);
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Write the output file
  fs.writeFileSync(outputPath, templateContent);
  console.info(`Generated container file for ${layer} layer at ${outputFile}`);
  
  if (injectables.length === 0) {
    if (DEBUG) console.debug(`Note: No injectable classes found for ${layer} layer, but an empty container was still generated`);
  }
  return outputFile;
}
