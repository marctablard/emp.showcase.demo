import type { Container } from 'inversify';
import { routingConfig } from '@/i18n/routing';
import type { EmporixCurrencyApi } from '@/platform/integrations/emporix/currency/EmporixCurrencyApi';
import type { EmporixSiteSettingsApi } from '@/platform/integrations/emporix/site-settings/EmporixSiteSettingsApi';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { validateRemoteConfig } from './remote-validation';

/**
 * Run the startup configuration healthcheck (Tier 2 — remote API validation).
 *
 * Tier 1 (env var presence) is handled at build-time in `next.config.ts`.
 * If the app is running, all required env vars are guaranteed to be present.
 *
 * This function is called from `instrumentation.ts register()` after logger
 * initialization. It is togglable via `NEXT_STARTUP_HEALTHCHECK_ENABLED`.
 */
export async function runStartupHealthcheck(container: Container): Promise<void> {
  const logger = container.get<LoggerService>('LoggerService');

  if (process.env.NEXT_STARTUP_HEALTHCHECK_ENABLED === 'false') {
    logger.info('Startup healthcheck disabled (NEXT_STARTUP_HEALTHCHECK_ENABLED=false)');
    return;
  }
  logger.info('Configuration healthcheck starting...');

  const siteSettingsApi = container.get<EmporixSiteSettingsApi>('EmporixSiteSettingsApi');
  const currencyApi = container.get<EmporixCurrencyApi>('EmporixCurrencyApi');

  const configuredSites = (process.env.NEXT_PUBLIC_AVAILABLE_SITES ?? '').split(',').filter(Boolean);
  const defaultCurrency = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? '';

  const result = await validateRemoteConfig({
    siteSettingsApi,
    currencyApi,
    configuredSites,
    defaultCurrency,
    configuredLocales: routingConfig.locales,
    logger,
  });

  const passed = result.items.filter((i) => i.passed).length;
  const warnings = result.items.filter((i) => !i.passed && i.severity === 'warning').length;
  const errors = result.items.filter((i) => !i.passed && i.severity === 'error').length;

  for (const item of result.items) {
    if (item.passed) {
      logger.info({ check: item.name }, `✓ ${item.message}`);
    } else if (item.severity === 'error') {
      logger.error({ check: item.name }, `✗ ${item.message}`);
    } else {
      logger.warn({ check: item.name }, `⚠ ${item.message}`);
    }
  }

  // Config mismatches (site/currency/language) are 'error' and trigger shutdown.
  if (result.hasErrors) {
    logger.fatal({ passed, warnings, errors }, `Configuration healthcheck failed: ${errors} error(s). Shutting down.`);
    process.exit(1);
  }

  if (result.hasWarnings) {
    logger.warn(
      { passed, warnings },
      `Configuration healthcheck completed with warnings: ${passed} passed, ${warnings} warning(s)`,
    );
  } else {
    logger.info({ passed }, `Configuration healthcheck completed: ${passed} passed, 0 warnings`);
  }
}
