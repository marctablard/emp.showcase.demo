import { routingConfig } from '@/i18n/routing';
import type { LocalizedString } from '@/platform/services/model/common';

/** Shown when a localized object/array has no value for the session locale or `defaultLocale`. */
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

/**
 * Resolves localized catalog/API values for display:
 * 1. Session (or caller) `locale`
 * 2. `defaultLocale` (defaults to `routingConfig.defaultLocale`)
 * 3. {@link L10N_MISSING_LABEL} when the value is structured (object/array) but neither locale matches
 *
 * Plain strings are returned as-is (they are not locale-keyed).
 */
export function resolveLocalizedString(
  input: L10nInput,
  locale: string,
  defaultLocale: string = routingConfig.defaultLocale,
): string {
  if (input === null || input === undefined) {
    return '';
  }

  if (typeof input === 'string') {
    return input;
  }

  if (Array.isArray(input)) {
    if (input.length === 0) {
      return '';
    }
    try {
      let value = pickFromArray(input as { language: string; message: string }[], locale);
      if (value) {
        return value;
      }
      if (defaultLocale !== locale) {
        value = pickFromArray(input as { language: string; message: string }[], defaultLocale);
        if (value) {
          return value;
        }
      }
      return L10N_MISSING_LABEL;
    } catch {
      return '';
    }
  }

  if (typeof input === 'object') {
    try {
      const record = input as Record<string, unknown>;
      let value = pickFromObject(record, locale);
      if (value) {
        return value;
      }
      if (defaultLocale !== locale) {
        value = pickFromObject(record, defaultLocale);
        if (value) {
          return value;
        }
      }
      return L10N_MISSING_LABEL;
    } catch {
      return '';
    }
  }

  return '';
}

/**
 * @param defaultLocale Optional override; defaults to `routingConfig.defaultLocale`.
 */
export function l10n(input: L10nInput, locale: string, defaultLocale: string = routingConfig.defaultLocale): string {
  return resolveLocalizedString(input, locale, defaultLocale);
}

/** Like {@link l10n}, but returns an empty string when no locale matches (e.g. for `alt` text). */
export function l10nOrEmpty(
  input: L10nInput,
  locale: string,
  defaultLocale: string = routingConfig.defaultLocale,
): string {
  const s = resolveLocalizedString(input, locale, defaultLocale);
  return s === L10N_MISSING_LABEL ? '' : s;
}
