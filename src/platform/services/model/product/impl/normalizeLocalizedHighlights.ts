import type { Product } from '@/platform/services/model/product';

type LocalizedHighlights = NonNullable<Product['highlights']>;

// TODO: unlocalized string[] highlights default to 'en' — matches BatteryIncludedProductMapper; replace when a real locale source is defined // NOSONAR
const DEFAULT_STRING_ARRAY_LOCALE = 'en';

interface LanguageValueEntry {
  language: string;
  value: unknown;
}

const isLanguageValueEntry = (item: unknown): item is LanguageValueEntry => {
  return (
    typeof item === 'object' &&
    item !== null &&
    !Array.isArray(item) &&
    typeof (item as { language?: unknown }).language === 'string'
  );
};

const appendHighlight = (accumulator: LocalizedHighlights, language: string, value: string): void => {
  accumulator[language] = [...(accumulator[language] ?? []), value];
};

const finalizeHighlights = (localizedHighlights: LocalizedHighlights): Product['highlights'] => {
  return Object.keys(localizedHighlights).length > 0 ? localizedHighlights : undefined;
};

const normalizeArrayOfLanguageValueArrays = (value: unknown[][]): Product['highlights'] => {
  const localizedHighlights = value.reduce<LocalizedHighlights>((accumulator, bullet) => {
    for (const entry of bullet) {
      if (!isLanguageValueEntry(entry)) {
        continue;
      }

      if (typeof entry.value === 'string') {
        appendHighlight(accumulator, entry.language, entry.value);
      }
    }

    return accumulator;
  }, {});

  return finalizeHighlights(localizedHighlights);
};

const normalizeFlatLanguageValueArray = (value: unknown[]): Product['highlights'] => {
  const localizedHighlights = value.reduce<LocalizedHighlights>((accumulator, item) => {
    if (!isLanguageValueEntry(item)) {
      return accumulator;
    }

    if (typeof item.value === 'string') {
      appendHighlight(accumulator, item.language, item.value);
    }

    if (Array.isArray(item.value)) {
      const localizedValues = item.value.filter(
        (nestedItem: unknown): nestedItem is string => typeof nestedItem === 'string',
      );
      if (localizedValues.length > 0) {
        accumulator[item.language] = [...(accumulator[item.language] ?? []), ...localizedValues];
      }
    }

    return accumulator;
  }, {});

  return finalizeHighlights(localizedHighlights);
};

const normalizeLocaleRecord = (value: object): Product['highlights'] => {
  const localizedHighlights = Object.entries(value as Record<string, unknown>).reduce<LocalizedHighlights>(
    (accumulator, [locale, item]) => {
      if (typeof item === 'string') {
        accumulator[locale] = [item];
      }

      if (Array.isArray(item)) {
        const localizedValues = item.filter(
          (nestedItem: unknown): nestedItem is string => typeof nestedItem === 'string',
        );
        if (localizedValues.length > 0) {
          accumulator[locale] = localizedValues;
        }
      }

      return accumulator;
    },
    {},
  );

  return finalizeHighlights(localizedHighlights);
};

/**
 * Converts any observed highlights-mixin payload into `Product['highlights']`.
 * Handles the canonical `Array<Array<{ language, value }>>` shape plus the
 * tolerant shapes historically accepted by BatteryIncludedProductMapper.
 */
export const normalizeLocalizedHighlights = (value: unknown): Product['highlights'] => {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    if (value.every((item): item is string => typeof item === 'string')) {
      return value.length > 0 ? { [DEFAULT_STRING_ARRAY_LOCALE]: value } : undefined;
    }

    if (value.every((item) => Array.isArray(item))) {
      return normalizeArrayOfLanguageValueArrays(value);
    }

    return normalizeFlatLanguageValueArray(value);
  }

  if (typeof value === 'object') {
    return normalizeLocaleRecord(value);
  }

  return undefined;
};
