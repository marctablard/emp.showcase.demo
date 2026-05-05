import type { CMSComponentEntry } from '../../types';
import type { CMSComponentService } from '../CMSComponentService';

export abstract class AbstractCMSComponentService implements CMSComponentService {
  /**
   * Creates an instance of AbstractCMSComponentService.
   *
   * @param definitionMap Record of component type id to CMSComponentEntry.
   */
  constructor(private readonly definitionMap: Record<string, CMSComponentEntry> = {}) {
    // supply definitions through constructor
  }

  /**
   * @param theme Optional theme override. When omitted, falls back to the
   *              `defaultTheme` supplied at construction time.
   *              Entries without a `themes` restriction are always returned.
   */
  getDefinitions(theme?: string): CMSComponentEntry[] {
    return Object.values(this.definitionMap).filter((entry) => this.isExposed(entry, theme));
  }

  /**
   * @param type  Component type identifier.
   * @param theme Optional theme override (see {@link getDefinitions}).
   * @returns The matching entry, or undefined if the type is not registered
   *          or is theme-restricted and the active theme does not match.
   */
  getDefinition(type: string, theme?: string): CMSComponentEntry | undefined {
    const entry = this.definitionMap[type];
    if (!entry) return undefined;
    return this.isExposed(entry, theme) ? entry : undefined;
  }

  /**
   * @param theme Optional theme override (see {@link getDefinitions}).
   */
  getComponentTypes(theme?: string): string[] {
    return Object.entries(this.definitionMap)
      .filter(([, entry]) => this.isExposed(entry, theme))
      .map(([type]) => type);
  }

  /**
   * An entry is exposed when it is theme-neutral (no `themes` field set) or
   * when the active `theme` is listed in its `themes` array.
   */
  private isExposed(entry: CMSComponentEntry, theme: string | undefined): boolean {
    if (!theme) return true;

    if (!entry.themes || !Array.isArray(entry.themes) || entry.themes.length === 0) return true;

    return entry.themes.includes(theme);
  }
}
