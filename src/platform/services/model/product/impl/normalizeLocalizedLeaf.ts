import { LocalizedString } from '@/platform/services/model/i18n';

export const normalizeLocalizedLeaf = (value: unknown, fallbackKey?: string): LocalizedString | undefined => {
  if (!value) return fallbackKey ? { en: fallbackKey } : undefined;

  if (Array.isArray(value)) {
    const reduced = value.reduce((acc: Record<string, string>, item: unknown) => {
      if (typeof item === 'object' && item !== null && 'language' in item && 'value' in item) {
        const lang = (item as { language: unknown }).language;
        const val = (item as { value: unknown }).value;
        if (typeof lang === 'string' && typeof val === 'string' && lang && val) {
          acc[lang] = val;
        }
      }
      return acc;
    }, {});

    if (Object.keys(reduced).length === 0) {
      return fallbackKey ? { en: fallbackKey } : undefined;
    }

    return reduced;
  }

  if (typeof value === 'object' && value !== null) {
    if (Object.keys(value).length === 0) {
      return fallbackKey ? { en: fallbackKey } : undefined;
    }
    return value as LocalizedString;
  }

  return { en: String(value) };
};
