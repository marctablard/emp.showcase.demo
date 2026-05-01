import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { getPublicDefaultCurrency, getPublicDefaultLanguage } from '@/lib/common/public-default-env';
import type { LocalizedString, SearchParams } from '@/platform/services/model/common';
import type { Session } from '@/platform/services/model/session/session';

function buildBaseUrl() {
  const envUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'emporix-showcase.com';
  if (envUrl.startsWith('http://') || envUrl.startsWith('https://')) {
    return envUrl;
  }
  return 'https://' + envUrl;
}

export const baseUrl = buildBaseUrl();

const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      // Allow all options from custom utility border-width-* defined in src/app/globals.css
      'border-w': [{ 'border-width': [() => true] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return customTwMerge(clsx(inputs));
}

/**
 * Translate Search Parameters to Query and Body (for POST)
 * @param params
 * @returns { body : q-Parameter for Search-Criteria, query : Query-Parameters }
 */
export function buildSearchQuery<T>(params: SearchParams<T>): { body: string; query: string } {
  const queryParams = new URLSearchParams();

  if (params.page) {
    queryParams.append('pageNumber', params.page.toString());
  }
  if (params.size) {
    queryParams.append('pageSize', params.size.toString());
  }
  if (params.sort) {
    queryParams.append('sort', params.sort);
  }
  let query: string = '';
  if (params.criteria) {
    Object.entries(params.criteria).forEach(([key, value]) => {
      if (query.length > 0) {
        query += ' ';
      }
      query += `${key}:${value}`;
    });
  }

  return { body: query, query: queryParams.toString() };
}

/**
 * Format a currency value with the appropriate currency symbol
 * @param amount The amount to format
 * @param currencyCode The ISO currency code (e.g., 'USD', 'EUR')
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currencyCode?: string, locale?: Session['language']): string {
  const code = currencyCode ?? getPublicDefaultCurrency();
  const loc = locale ?? getPublicDefaultLanguage(); // if locale is not provided it will set currency formatter to the default language from NEXT_PUBLIC_DEFAULT_LANGUAGE env
  return new Intl.NumberFormat(loc, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyToParts(
  amount: number,
  currencyCode?: string,
  locale?: Session['language'],
): Intl.NumberFormatPart[] {
  const code = currencyCode ?? getPublicDefaultCurrency();
  const loc = locale ?? getPublicDefaultLanguage();
  return new Intl.NumberFormat(loc, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(amount);
}

/**
 * Build a canonical URL for a product page
 * @param locale The locale code (e.g., 'en', 'fr')
 * @param id The product ID
 * @returns Canonical URL for the product page
 */
export function buildCanonicalUrl(locale: string, path: string): string {
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  return `${baseUrl}${locale === getPublicDefaultLanguage() ? '' : `/${locale}`}${path}`;
}
/**
 * Placeholder returned by `l10n` when the localized input has entries
 * but none of them match the deterministic fallback chain.
 *
 * Returned only when data exists in languages outside the configured
 * fallback order — never when the input is empty/missing (those keep
 * the legacy empty-string contract so `l10n(x) || fallback` works).
 */
export const L10N_PLACEHOLDER = '-';

/**
 * Build the deterministic lookup chain for `l10n`:
 *   [currentLocale, ...callerFallbacks, NEXT_PUBLIC_DEFAULT_LANGUAGE]
 *
 * Empty / non-string entries are dropped and duplicates removed so the
 * chain is stable across call sites. The env default is always appended
 * last so every caller — even ones that don't know the site default —
 * gets a consistent final fallback instead of a random "first value".
 */
function buildLocaleChain(
  locale?: string | null,
  fallbackLocales?: ReadonlyArray<string | null | undefined>,
): string[] {
  const chain: string[] = [];
  const push = (candidate: string | null | undefined) => {
    if (typeof candidate === 'string' && candidate.length > 0 && !chain.includes(candidate)) {
      chain.push(candidate);
    }
  };
  push(locale);
  fallbackLocales?.forEach(push);
  push(getPublicDefaultLanguage());
  return chain;
}

/**
 * Extract the localized value from a LocalizedString, array format, or
 * return the string directly.
 *
 * Fallback order (deterministic — no random "first available"):
 *   1. `locale` (usually the current UI locale)
 *   2. each entry in `fallbackLocales` (e.g. `site.defaultLanguage`)
 *   3. `NEXT_PUBLIC_DEFAULT_LANGUAGE` (env default, always appended)
 *
 * Return value semantics:
 *   - empty / null / undefined input → `''`
 *   - plain string input → returned as-is
 *   - localized map / array with a match in the chain → matched value
 *   - localized map / array with entries but no match in the chain → `L10N_PLACEHOLDER`
 *   - localized map / array with no valid string entries at all → `''`
 *
 * Client components should normally consume this via `useL10n()`, which
 * threads `site.defaultLanguage` through `fallbackLocales` automatically.
 */
export function l10n(
  input: string | LocalizedString | Array<{ language: string; message: string }> | unknown,
  locale?: string | null,
  fallbackLocales?: ReadonlyArray<string | null | undefined>,
): string {
  if (input === null || input === undefined || input === '') {
    return '';
  }

  if (typeof input === 'string') {
    return input;
  }

  const chain = buildLocaleChain(locale, fallbackLocales);

  if (Array.isArray(input)) {
    try {
      for (const lang of chain) {
        const match = input.find(
          (item) =>
            item !== null &&
            typeof item === 'object' &&
            (item as { language?: unknown }).language === lang &&
            typeof (item as { message?: unknown }).message === 'string',
        ) as { message: string } | undefined;
        if (match) {
          return match.message;
        }
      }
      const hasValidEntry = input.some(
        (item) =>
          item !== null &&
          typeof item === 'object' &&
          typeof (item as { language?: unknown }).language === 'string' &&
          typeof (item as { message?: unknown }).message === 'string',
      );
      return hasValidEntry ? L10N_PLACEHOLDER : '';
    } catch {
      return '';
    }
  }

  if (typeof input === 'object') {
    try {
      const record = input as Record<string, unknown>;
      for (const lang of chain) {
        const value = record[lang];
        if (typeof value === 'string' && value.length > 0) {
          return value;
        }
      }
      const hasValidEntry = Object.values(record).some((v) => typeof v === 'string' && v.length > 0);
      return hasValidEntry ? L10N_PLACEHOLDER : '';
    } catch {
      return '';
    }
  }

  return '';
}

// TODO fill with correct sizes
export const imageSizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw';
