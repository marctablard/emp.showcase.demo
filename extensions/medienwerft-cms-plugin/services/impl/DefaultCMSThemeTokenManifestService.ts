import { injectable } from '@/platform/core/di/injectable';
import type {
  CMSThemeTokenManifestService as ICMSThemeTokenManifestService,
  ThemeTokenManifest,
} from '../CMSThemeTokenManifestService';

/**
 * Ships an empty manifest so every host has a valid `THEME_TOKENS_RESPONSE`
 * payload even before it wires a concrete provider. The live bridge
 * resolves this service during SSR (via `fetchCMSThemeTokenManifest`)
 * and forwards the result to the editor over the iframe postMessage
 * channel — there is no HTTP endpoint involved.
 *
 * Registered under its own id (`DefaultCMSThemeTokenManifestService`)
 * and mapped to the interface id via the plugin.json `aliases` block
 * — this mirrors the `CMSService` / `CMSSettingsService` /
 * `CMSThemeService` pattern. A storefront that wants to supply its
 * own manifest registers a class under
 * `StorefrontCMSThemeTokenManifestService` and updates
 * `plugin.json` so the alias resolves to the storefront's id, which
 * cleanly overrides the default (aliases run after module binding in
 * the generated `ssr.ts` / `client.ts`).
 */
@injectable('DefaultCMSThemeTokenManifestService', 'Singleton')
export class DefaultCMSThemeTokenManifestService implements ICMSThemeTokenManifestService {
  async getManifest(site: string): Promise<ThemeTokenManifest | null> {
    return {
      site,
      fallback: true,
      groups: [],
    };
  }
}

export default DefaultCMSThemeTokenManifestService;
