import type { CMSComponentEntry } from './types';

/**
 * Service that provides CMS component definitions.
 *
 * This interface is defined by the CMS extension to specify what it needs
 * from the storefront. The storefront implements this interface to provide
 * its component definitions, achieving true dependency inversion.
 *
 * The extension depends on the abstraction (this interface), not on concrete
 * implementations, allowing different storefronts to provide different components.
 */
export interface CMSComponentService {
  /**
   * Get all registered component definitions, optionally filtered by theme.
   *
   * @param theme Optional theme identifier. When provided, only theme-neutral
   *              entries and entries whose `themes` array contains this theme
   *              are returned. When omitted, the implementation's configured
   *              default theme is used.
   * @returns Array of component entries (definition, mapProps, component).
   */
  getDefinitions(theme?: string): CMSComponentEntry[];

  /**
   * Get a specific component definition by type, optionally scoped to a theme.
   *
   * @param type  The component type identifier.
   * @param theme Optional theme identifier (see {@link getDefinitions}).
   * @returns The component entry or undefined if not found / not exposed
   *          under the active theme.
   */
  getDefinition(type: string, theme?: string): CMSComponentEntry | undefined;

  /**
   * Get all registered component type identifiers, optionally filtered by theme.
   *
   * @param theme Optional theme identifier (see {@link getDefinitions}).
   */
  getComponentTypes(theme?: string): string[];

  /**
   * Get the active theme identifier the service was configured with.
   * When set, theme-restricted components whose `themes` array does not
   * contain this identifier are filtered out of every accessor.
   *
   * @returns The active theme id, or undefined if the service is running
   *          theme-neutral (all theme-scoped components are hidden).
   */
  getTheme?(): string | undefined;
}
