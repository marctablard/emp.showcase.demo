import { routingConfig } from '@/i18n/routing';
import type { LocalizedString } from '@/platform/services/model/common';

/** Shown when a localized object/array has no value for the session, fallback, or default locale. */
export const L10N_MISSING_LABEL = '-';

export type L10nInput = string | LocalizedString | Array<{ language: string; message: string }> | unknown;

function normalizedMessage(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function pickFromArray(input: Array<{ language: string; message: string }>, lang: string): string {
  const item = input.find((i) => i && typeof i === 'object' && i.language === lang);
  if (!item || typeof item.message !== 'string') {
    return '';
  }
  return normalizedMessage(item.message);
}

function pickFromObject(input: Record<string, unknown>, key: string): string {
  return normalizedMessage(input[key]);
}

function uniqueLocales(locales: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const locale of locales) {
    if (!locale || seen.has(locale)) {
      continue;
    }
    seen.add(locale);
    ordered.push(locale);
  }
  return ordered;
}

function pickFirstLocalized(locales: string[], pick: (locale: string) => string): string {
  for (const candidate of locales) {
    const value = pick(candidate);
    if (value) {
      return value;
    }
  }
  return L10N_MISSING_LABEL;
}

function resolveFromLocalizedArray(input: unknown[], locales: string[]): string {
  if (input.length === 0) {
    return '';
  }
  try {
    const items = input as Array<{ language: string; message: string }>;
    return pickFirstLocalized(locales, (candidate) => pickFromArray(items, candidate));
  } catch {
    return '';
  }
}

function resolveFromLocalizedObject(input: object, locales: string[]): string {
  try {
    return pickFirstLocalized(locales, (candidate) => pickFromObject(input as Record<string, unknown>, candidate));
  } catch {
    return '';
  }
}

/**
 * Resolves localized catalog/API values for display:
 * 1. Session (or caller) `locale`
 * 2. `fallbackLocale` when provided (typically `site.defaultLanguage`)
 * 3. `defaultLocale` (defaults to `routingConfig.defaultLocale`)
 * 4. {@link L10N_MISSING_LABEL} when the value is structured (object/array) but no locale matches
 *
 * Plain strings are returned as-is (they are not locale-keyed).
 */
export function resolveLocalizedString(
  input: L10nInput,
  locale: string,
  defaultLocale: string = routingConfig.defaultLocale,
  fallbackLocale?: string,
): string {
  if (input === null || input === undefined) {
    return '';
  }

  if (typeof input === 'string') {
    return input;
  }

  const locales = uniqueLocales([locale, fallbackLocale, defaultLocale]);

  if (Array.isArray(input)) {
    return resolveFromLocalizedArray(input, locales);
  }

  if (typeof input === 'object') {
    return resolveFromLocalizedObject(input, locales);
  }

  return '';
}

/**
 * @param defaultLocale Optional override; defaults to `routingConfig.defaultLocale`.
 * @param fallbackLocale Optional locale tried after `locale` and before `defaultLocale`.
 */
export function l10n(
  input: L10nInput,
  locale: string,
  defaultLocale: string = routingConfig.defaultLocale,
  fallbackLocale?: string,
): string {
  return resolveLocalizedString(input, locale, defaultLocale, fallbackLocale);
}

/** Like {@link l10n}, but returns an empty string when no locale matches (e.g. for `alt` text). */
export function l10nOrEmpty(
  input: L10nInput,
  locale: string,
  defaultLocale: string = routingConfig.defaultLocale,
  fallbackLocale?: string,
): string {
  const s = resolveLocalizedString(input, locale, defaultLocale, fallbackLocale);
  return s === L10N_MISSING_LABEL ? '' : s;
}
