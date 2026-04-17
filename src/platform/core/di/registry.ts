import { Container } from 'inversify';
import { ID_KEY } from './injectable';
import type { AvailableBinding, Layer } from './types';

const registry = new Map<string, AvailableBinding>();
const containers = new Map<string, Container>();

/**
 * Adds a module to a container using our custom injectable annotation
 * @param module
 * @param container
 */
export function addInjectableModule(module: any, container: Container): void {
  // Check if it's a class and has injectable metadata
  const metadataKeys = Reflect.getMetadataKeys(module);
  if (typeof module === 'function' && metadataKeys.includes(ID_KEY)) {
    // Get the identifier for the class using our helper function
    const identifier = Reflect.getMetadata(ID_KEY, module);
    // prevent duplicate identifiers
    if (container.isBound(identifier)) {
      container.unbind(identifier);
    }
    container.bind(identifier).to(module);
  }
}

/**
 * Dynamically imports a module and registers any injectable classes with the container
 * @param container The container to register classes with
 * @param modulePath Path to the module
 * @param basePath Base path for calculating relative paths
 */
export function registerModule(module: any, layer: Layer): void {
  // Check if it's a class and has injectable metadata
  const metadataKeys = Reflect.getMetadataKeys(module);
  if (typeof module === 'function' && metadataKeys.includes(ID_KEY)) {
    // Get the identifier for the class using our helper function
    const identifier = Reflect.getMetadata(ID_KEY, module);
    registry.set(identifier, { identifier, injectable: module, layer });
  }
}

/**
 * Creates a new container and registers all injectable classes from the specified directory
 * @param directoryPath Path to the directory to scan for injectable classes
 * @returns Promise with the configured container
 */
function createContainer(layer: Layer): Container {
  // Create a new inversify container
  const container = new Container({ defaultScope: 'Singleton' });
  registry.forEach((value, _key) => {
    if (value.layer === layer) {
      container.bind(value.identifier).to(value.injectable);
    }
  });
  containers.set(layer, container);
  return container;
}

export function getContainer(layer: Layer): Container {
  return containers.get(layer) || createContainer(layer);
}

export default getContainer;
