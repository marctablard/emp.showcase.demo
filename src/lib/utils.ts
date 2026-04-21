import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { getPublicDefaultCurrency, getPublicDefaultLanguage } from '@/lib/common/public-default-env';
import type { SearchParams } from '@/platform/services/model/common';
import type { Session } from '@/platform/services/model/session/session';

export { L10N_MISSING_LABEL, l10n, l10nOrEmpty, resolveLocalizedString } from './l10n';
export type { L10nInput } from './l10n';

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
  const loc = locale ?? getPublicDefaultLanguage();
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
// TODO fill with correct sizes
export const imageSizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw';
