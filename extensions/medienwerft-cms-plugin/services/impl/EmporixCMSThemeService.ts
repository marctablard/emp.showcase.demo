import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { EmporixCmsThemeApi, RawCmsTheme } from '../../integrations/EmporixCmsThemeApi';
import type { CMSTheme, GetThemeOptions, CMSThemeService as ICMSThemeService } from '../CMSThemeService';

/**
 * Matches `--token` or `--token-name` identifiers. Anything else is
 * rejected so an editor can't inject stylesheet syntax via a variable
 * key (e.g. `background: url(evil)`).
 */
const VALID_VARIABLE_NAME = /^--[a-z0-9][a-z0-9-_]*$/i;

/**
 * CSS value allow-list — deliberately strict.
 *  - No semicolons (would close the declaration).
 *  - No `<`, `>` (HTML injection guard when inlined into <style>).
 *  - No `url(` (blocks remote resource loading from a theme var).
 *  - No `expression(`, `javascript:` (legacy IE / URL injection).
 */
const VALID_VARIABLE_VALUE = /^[^;<>]+$/;
const DISALLOWED_VALUE_TOKENS = /url\s*\(|expression\s*\(|javascript\s*:/i;

const MAX_VARIABLE_COUNT = 500;

/**
 * Resolves the active theme for a site with draft → live fallback.
 *
 * Cross-request caching lives one layer down — `EmporixCmsThemeApi`
 * issues its Emporix reads with `next: { revalidate: 300 }`, so the
 * Next.js data cache deduplicates fetches for the same entity across
 * lambda invocations. Editor previews bypass this layer entirely (the
 * `<style data-cms-theme-override>` element is patched in-place via
 * postMessage); shoppers see published changes after the per-fetch TTL
 * expires.
 *
 * The service is intentionally tolerant: any failure in the API layer
 * degrades to `null`, which storefront code renders as "base theme
 * only". A bad theme entity should never break the page.
 */
@injectable('EmporixCMSThemeService', 'Singleton')
export class EmporixCMSThemeService implements ICMSThemeService {
  constructor(
    @inject('EmporixCmsThemeApi') private themeApi: EmporixCmsThemeApi,
    @inject('LoggerService') private logger: LoggerService,
  ) {}

  async getThemeForSite(site: string, options?: GetThemeOptions): Promise<CMSTheme | null> {
    if (!site) return null;
    const requestedVersion = options?.version ?? 'live';

    try {
      return await this.loadTheme(site, requestedVersion);
    } catch (error) {
      this.logger.warn(
        {
          err: error instanceof Error ? error.message : String(error),
          site,
          version: requestedVersion,
        },
        'Failed to resolve CMS theme — degrading to null',
      );
      return null;
    }
  }

  /**
   * Fetch → draft→live fallback → sanitize. Kept as a separate method
   * so tests can exercise the resolution path directly.
   */
  private async loadTheme(site: string, version: 'draft' | 'live' | string): Promise<CMSTheme | null> {
    let raw = await this.themeApi.getThemeEntity(site, version);

    // Draft → live fallback: a site may have a live theme without a
    // draft. Matches the behavior of EmporixCMSService.
    if (!raw && version === 'draft') {
      raw = await this.themeApi.getThemeEntity(site, 'live');
    }

    if (!raw) return null;
    return this.sanitize(raw);
  }

  /**
   * Drop anything that doesn't look like a CSS custom property. We
   * surface a per-field warning rather than rejecting the whole theme
   * so a single typo can't blank the site.
   */
  private sanitize(raw: RawCmsTheme): CMSTheme {
    const entries = Object.entries(raw.variables);
    const trimmed = entries.slice(0, MAX_VARIABLE_COUNT);
    if (entries.length > MAX_VARIABLE_COUNT) {
      this.logger.warn(
        { site: raw.site, count: entries.length, cap: MAX_VARIABLE_COUNT },
        'Theme variable count exceeds cap — truncating',
      );
    }

    const sanitized: Record<string, string> = {};
    for (const [rawName, rawValue] of trimmed) {
      const name = rawName.trim();
      const value = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (!name || !value) continue;
      if (!VALID_VARIABLE_NAME.test(name)) {
        this.logger.warn({ site: raw.site, name }, 'Rejected theme variable with invalid name');
        continue;
      }
      if (!VALID_VARIABLE_VALUE.test(value) || DISALLOWED_VALUE_TOKENS.test(value)) {
        this.logger.warn({ site: raw.site, name }, 'Rejected theme variable with disallowed value');
        continue;
      }
      sanitized[name] = value;
    }

    return {
      site: raw.site,
      baseTheme: raw.baseTheme,
      variables: sanitized,
      version: raw.version,
      baseId: raw.baseId,
      author: raw.author,
    };
  }
}

export default EmporixCMSThemeService;
