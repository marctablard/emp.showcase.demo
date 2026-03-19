import type { EmporixCurrencyApi } from '@/platform/integrations/emporix/currency/EmporixCurrencyApi';
import type { EmporixSiteSettingsApi } from '@/platform/integrations/emporix/site-settings/EmporixSiteSettingsApi';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { HealthcheckItem, HealthcheckResult } from './types';

/** Parameters for remote configuration validation. */
export interface RemoteValidationParams {
  /** API client for fetching site settings from the Emporix tenant. */
  siteSettingsApi: EmporixSiteSettingsApi;
  /** API client for fetching available currencies from the Emporix tenant. */
  currencyApi: EmporixCurrencyApi;
  /** Site codes from `NEXT_PUBLIC_AVAILABLE_SITES`, already split and filtered. */
  configuredSites: string[];
  /** Default currency code from `NEXT_PUBLIC_DEFAULT_CURRENCY`. */
  defaultCurrency: string;
  /** i18n locale codes from `routingConfig.locales`. */
  configuredLocales: readonly string[];
  /** Logger instance for diagnostic output during validation. */
  logger: LoggerService;
}

/**
 * Tier 2 — Validate application configuration against the Emporix backend.
 *
 * Checks:
 * 1. Each configured site exists in the tenant.
 * 2. The default currency exists in the tenant currencies.
 * 3. Each site's currency exists in the tenant currencies.
 * 4. Each site's languages are a subset of the configured i18n locales.
 *
 * Site/currency/language failures are severity `'error'` (hard fail — blocks
 * startup). API-unreachability errors are severity `'warning'` (soft fail —
 * transient infrastructure issue, not a config problem). The function never
 * throws.
 */
export async function validateRemoteConfig(params: RemoteValidationParams): Promise<HealthcheckResult> {
  const { siteSettingsApi, currencyApi, configuredSites, defaultCurrency, configuredLocales, logger } = params;

  const items: HealthcheckItem[] = [];

  try {
    // Fetch tenant currencies once for all currency checks
    const tenantCurrencies = await currencyApi.getCurrencies();
    const currencyCodes = new Set(tenantCurrencies.map((c) => c.code));

    // Check 2: Default currency exists in tenant
    if (currencyCodes.has(defaultCurrency)) {
      items.push({
        name: `currency:${defaultCurrency}`,
        passed: true,
        severity: 'error',
        message: `Default currency "${defaultCurrency}" exists in tenant`,
      });
    } else {
      items.push({
        name: `currency:${defaultCurrency}`,
        passed: false,
        severity: 'error',
        message: `Default currency "${defaultCurrency}" not found in tenant currencies`,
      });
    }

    // Check 1, 3, 4: Validate each configured site
    for (const siteCode of configuredSites) {
      const site = await siteSettingsApi.getSite(siteCode);

      if (!site) {
        items.push({
          name: `site:${siteCode}`,
          passed: false,
          severity: 'error',
          message: `Site "${siteCode}" not found in Emporix tenant`,
        });
        continue;
      }

      items.push({
        name: `site:${siteCode}`,
        passed: true,
        severity: 'error',
        message: `Site "${siteCode}" exists in tenant`,
      });

      // Check 3: Site currency in tenant currencies
      if (site.currency) {
        if (currencyCodes.has(site.currency)) {
          items.push({
            name: `site:${siteCode}:currency`,
            passed: true,
            severity: 'error',
            message: `Site "${siteCode}" currency "${site.currency}" exists in tenant currencies`,
          });
        } else {
          items.push({
            name: `site:${siteCode}:currency`,
            passed: false,
            severity: 'error',
            message: `Site "${siteCode}" currency "${site.currency}" not found in tenant currencies`,
          });
        }
      }

      // Check 4: Site languages vs configured i18n locales
      if (site.languages && site.languages.length > 0) {
        const missingLocales = site.languages.filter((lang) => !configuredLocales.includes(lang));
        if (missingLocales.length === 0) {
          items.push({
            name: `site:${siteCode}:languages`,
            passed: true,
            severity: 'error',
            message: `Site "${siteCode}" languages are all configured in i18n locales`,
          });
        } else {
          items.push({
            name: `site:${siteCode}:languages`,
            passed: false,
            severity: 'error',
            message: `Site "${siteCode}" has languages [${missingLocales.join(', ')}] not in configured i18n locales [${configuredLocales.join(', ')}]`,
          });
        }
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn({ error: errorMessage }, 'Remote validation skipped: API unreachable');
    items.push({
      name: 'api-connectivity',
      passed: false,
      severity: 'warning',
      message: `Remote validation skipped: API unreachable (${errorMessage})`,
    });
  }

  return {
    tier: 'remote',
    items,
    hasErrors: items.some((item) => !item.passed && item.severity === 'error'),
    hasWarnings: items.some((item) => !item.passed && item.severity === 'warning'),
  };
}
