import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { LocalizedString, SearchParams } from '@/platform/services/model/common';

function buildBaseUrl() {
  const envUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'emporix-showcase.com';
  if (envUrl.startsWith('http://') || envUrl.startsWith('https://')) {
    return envUrl;
  }
  return 'https://' + envUrl;
}

export const baseUrl = buildBaseUrl();

const defaultEmptyLocale = 'en';

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
export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
  return new Intl.NumberFormat('de', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyToParts(amount: number, currencyCode: string = 'USD'): Intl.NumberFormatPart[] {
  return new Intl.NumberFormat('de', {
    style: 'currency',
    currency: currencyCode,
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
  return `${baseUrl}${locale === defaultEmptyLocale ? '' : `/${locale}`}${path}`;
}
/**
 * Extract the localized value from a LocalizedString, array format, or return the string directly
 * @param input The string, LocalizedString, or array of language/message objects to localize
 * @param locale The locale to extract
 * @returns The localized string
 */
export function l10n(
  input: string | LocalizedString | Array<{ language: string; message: string }> | any,
  locale: string,
): string {
  if (!input) {
    return '';
  }

  // If input is a simple string, return it directly
  if (typeof input === 'string') {
    return input;
  }

  // Handle array format with language/message objects
  if (Array.isArray(input)) {
    try {
      // Find matching locale in array
      const matchingItem = input.find((item: any) => item && typeof item === 'object' && item.language === locale);

      if (matchingItem && typeof matchingItem.message === 'string') {
        return matchingItem.message;
      }

      // Fallback to first available message with valid language
      const firstValidItem = input.find(
        (item: any) =>
          item && typeof item === 'object' && typeof item.message === 'string' && typeof item.language === 'string',
      );
      return firstValidItem ? firstValidItem.message : '';
    } catch {
      // Fail gracefully on any array processing error
      return '';
    }
  }

  // Handle object format (LocalizedString)
  if (typeof input === 'object' && input !== null) {
    try {
      // Try to get the value for the current locale
      if (input[locale] && typeof input[locale] === 'string') {
        return input[locale];
      }

      // If all else fails, return the first available string value or an empty string
      const firstAvailableLocale = Object.keys(input).find((key) => typeof input[key] === 'string');
      return firstAvailableLocale ? input[firstAvailableLocale] : '';
    } catch {
      // Fail gracefully on any object processing error
      return '';
    }
  }

  // Fallback for any other type - fail gracefully
  return '';
}

// TODO fill with correct sizes
export const imageSizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw';
