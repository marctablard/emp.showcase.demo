import { routingConfig } from '@/i18n/routing';
import { type L10nInput, resolveLocalizedString } from '@/lib/l10n';

/**
 * Resolves a catalog identity name with the shared l10n chain:
 * locale → optional site fallback (`site.defaultLanguage`) → `routingConfig.defaultLocale`.
 */
export function resolveCatalogDisplayName(
  name: L10nInput,
  locale: string,
  fallbackLocale?: string,
  defaultLocale: string = routingConfig.defaultLocale,
): string {
  return resolveLocalizedString(name, locale, defaultLocale, fallbackLocale);
}
