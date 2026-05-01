import { getPublicDefaultLanguage } from '@/lib/common/public-default-env';
import { LocalizedString } from '@/platform/services/model/common';
import { L10N_PLACEHOLDER, formatCurrency, formatCurrencyToParts, l10n } from './utils';

const envDefault = getPublicDefaultLanguage();

describe('l10n function', () => {
  describe('null and undefined handling', () => {
    it('should return empty string for null input', () => {
      expect(l10n(null as any, 'en')).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(l10n(undefined as any, 'en')).toBe('');
    });

    it('should return empty string for empty string input', () => {
      expect(l10n('', 'en')).toBe('');
    });
  });

  describe('normal string input', () => {
    it('should return the same string when input is a normal string', () => {
      const input = 'Hello World';
      expect(l10n(input, 'en')).toBe('Hello World');
      expect(l10n(input, 'de')).toBe('Hello World');
      expect(l10n(input, 'fr')).toBe('Hello World');
    });

    it('should handle strings with special characters', () => {
      const input = 'Héllo Wörld! 🌍';
      expect(l10n(input, 'en')).toBe('Héllo Wörld! 🌍');
    });
  });

  describe('LocalizedString object format — deterministic fallback', () => {
    const localizedObject: LocalizedString = {
      de: 'Text in Deutsch',
      en: 'Message in English',
    };

    it('should return the value for the requested locale when present', () => {
      expect(l10n(localizedObject, 'de')).toBe('Text in Deutsch');
      expect(l10n(localizedObject, 'en')).toBe('Message in English');
    });

    it('should fall back to NEXT_PUBLIC_DEFAULT_LANGUAGE before returning placeholder', () => {
      // envDefault ('en' in .env.template) is present in the map, so it should be chosen
      // deterministically rather than picking a random "first available" entry.
      expect(l10n(localizedObject, 'fr')).toBe(
        envDefault === 'de' ? 'Text in Deutsch' : envDefault === 'en' ? 'Message in English' : L10N_PLACEHOLDER,
      );
    });

    it('should honor a caller-provided fallbackLocales chain (e.g. site.defaultLanguage)', () => {
      // Simulates site.defaultLanguage = 'de' with current locale not in map.
      expect(l10n(localizedObject, 'fr', ['de'])).toBe('Text in Deutsch');
    });

    it('should return placeholder when neither the locale, caller fallbacks, nor env default match', () => {
      const onlyPlMap: LocalizedString = { pl: 'Tekst po polsku' };
      // pick fallbacks that are guaranteed not to overlap with the env default / 'pl'
      const nonMatchingFallbacks = ['uk', 'it'].filter((l) => l !== envDefault);
      expect(l10n(onlyPlMap, 'uk', nonMatchingFallbacks)).toBe(
        envDefault === 'pl' ? 'Tekst po polsku' : L10N_PLACEHOLDER,
      );
    });

    it('should return the single available translation when it happens to match env default', () => {
      const singleLocale: LocalizedString = { [envDefault]: 'Env default translation' };
      expect(l10n(singleLocale, 'xx')).toBe('Env default translation');
    });

    it('should return empty string for empty object', () => {
      const emptyObject: LocalizedString = {};
      expect(l10n(emptyObject, 'en')).toBe('');
    });

    it('should handle object with multiple locales via direct match', () => {
      const multiLocale: LocalizedString = {
        en: 'English text',
        de: 'Deutscher Text',
        fr: 'Texte français',
        es: 'Texto en español',
      };

      expect(l10n(multiLocale, 'en')).toBe('English text');
      expect(l10n(multiLocale, 'de')).toBe('Deutscher Text');
      expect(l10n(multiLocale, 'fr')).toBe('Texte français');
      expect(l10n(multiLocale, 'es')).toBe('Texto en español');
    });

    it('should return the site-default translation when current locale is missing', () => {
      const product: LocalizedString = { en: 'item1', de: 'item 1', pl: 'item1' };
      // site.defaultLanguage = 'de', current locale unsupported
      expect(l10n(product, 'fr', ['de'])).toBe('item 1');
    });
  });

  describe('array format with language/message objects', () => {
    const arrayFormat = [
      { language: 'de', message: 'Text in Deutsch' },
      { language: 'en', message: 'Message in English' },
    ];

    it('should return the entry for the requested locale', () => {
      expect(l10n(arrayFormat, 'en')).toBe('Message in English');
      expect(l10n(arrayFormat, 'de')).toBe('Text in Deutsch');
    });

    it('should fall back deterministically to env default for missing locale', () => {
      const expected =
        envDefault === 'de' ? 'Text in Deutsch' : envDefault === 'en' ? 'Message in English' : L10N_PLACEHOLDER;
      expect(l10n(arrayFormat, 'fr')).toBe(expected);
    });

    it('should honor caller-provided fallbackLocales for array inputs', () => {
      expect(l10n(arrayFormat, 'fr', ['de'])).toBe('Text in Deutsch');
    });

    it('should return empty string for empty array', () => {
      const emptyArray: any[] = [];
      expect(l10n(emptyArray, 'en')).toBe('');
    });

    it('should skip malformed items and match only valid locale entries', () => {
      const malformedArray = [
        null,
        { language: 'en' },
        { message: 'No language' },
        { language: 'de', message: 'Valid German' },
        'invalid string item',
        undefined,
      ];

      expect(l10n(malformedArray, 'de')).toBe('Valid German');
      // No 'fr' in map and env default likely 'en' (no valid entry) → placeholder
      const expectedFr = envDefault === 'de' ? 'Valid German' : L10N_PLACEHOLDER;
      expect(l10n(malformedArray, 'fr')).toBe(expectedFr);
    });

    it('should return empty string when array has no valid items', () => {
      const invalidArray = [null, undefined, { language: 'en' }, { message: 'No language' }, 'string', 123];

      expect(l10n(invalidArray, 'en')).toBe('');
    });

    it('should ignore non-string messages and match remaining valid entries', () => {
      const arrayWithNonStringMessages = [
        { language: 'en', message: null },
        { language: 'de', message: 123 },
        { language: 'fr', message: 'Valid French' },
      ];

      expect(l10n(arrayWithNonStringMessages, 'fr')).toBe('Valid French');
      // 'en'/'de' entries are invalid; caller fallback chain can reach 'fr'
      expect(l10n(arrayWithNonStringMessages, 'en', ['fr'])).toBe('Valid French');
    });
  });

  describe('edge cases', () => {
    it('should handle locale parameter variations', () => {
      const localizedObject: LocalizedString = {
        'en-US': 'American English',
        'en-GB': 'British English',
        'de-DE': 'German',
      };

      expect(l10n(localizedObject, 'en-US')).toBe('American English');
      expect(l10n(localizedObject, 'en-GB')).toBe('British English');
      expect(l10n(localizedObject, 'de-DE')).toBe('German');
    });

    it('should treat locale keys as case-sensitive', () => {
      const localizedObject: LocalizedString = {
        EN: 'UPPERCASE English',
        en: 'lowercase english',
      };

      expect(l10n(localizedObject, 'EN')).toBe('UPPERCASE English');
      expect(l10n(localizedObject, 'en')).toBe('lowercase english');
      // 'En' is neither in the map nor covered by env default directly unless envDefault==='EN' (unlikely)
      const expected =
        envDefault === 'en' ? 'lowercase english' : envDefault === 'EN' ? 'UPPERCASE English' : L10N_PLACEHOLDER;
      expect(l10n(localizedObject, 'En')).toBe(expected);
    });

    it('should skip non-string values and match only valid string entries', () => {
      const invalidObject = {
        en: 'Valid string',
        de: null,
        fr: undefined,
        es: 123,
      } as any;

      expect(l10n(invalidObject, 'en')).toBe('Valid string');
      // non-string values for 'de'/'es' mean those locales don't match; env default (likely 'en') wins, else placeholder
      const expected = envDefault === 'en' ? 'Valid string' : L10N_PLACEHOLDER;
      expect(l10n(invalidObject, 'de')).toBe(expected);
      expect(l10n(invalidObject, 'es')).toBe(expected);
    });

    it('should handle completely invalid input types gracefully', () => {
      expect(l10n(123 as any, 'en')).toBe('');
      expect(l10n(true as any, 'en')).toBe('');
      expect(l10n(Symbol('test') as any, 'en')).toBe('');
      expect(l10n((() => 'function') as any, 'en')).toBe('');
    });

    it('should handle objects that throw errors during processing', () => {
      const problematicObject = {
        get en() {
          throw new Error('Property access error');
        },
        de: 'German text',
      };

      expect(l10n(problematicObject as any, 'en')).toBe('');
    });

    it('should handle arrays that throw errors during processing', () => {
      const problematicArray = [
        {
          get language() {
            throw new Error('Property access error');
          },
          message: 'Test',
        },
      ];

      expect(l10n(problematicArray as any, 'en')).toBe('');
    });

    it('should dedupe the fallback chain (locale same as site default same as env default)', () => {
      const map: LocalizedString = { [envDefault]: 'Env translation only' };
      // All fallbacks collapse to envDefault; expect single lookup success.
      expect(l10n(map, envDefault, [envDefault])).toBe('Env translation only');
    });

    it('should ignore empty / non-string fallback entries in the chain', () => {
      const map: LocalizedString = { en: 'English only' };
      expect(l10n(map, 'fr', ['', null as any, undefined as any, 'en'])).toBe('English only');
    });
  });
});

describe('currency formatting utilities', () => {
  it('formats currency using explicitly provided locale', () => {
    const amount = 1234.5;
    const expected = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

    expect(formatCurrency(amount, 'EUR', 'en-US')).toBe(expected);
  });

  it('uses default language from env when locale is omitted', () => {
    const amount = 1234.5;
    const expected = new Intl.NumberFormat(getPublicDefaultLanguage(), {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

    expect(formatCurrency(amount, 'EUR')).toBe(expected);
  });

  it('formats currency parts using locale resolution', () => {
    const amount = 99.99;
    const expected = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).formatToParts(amount);

    expect(formatCurrencyToParts(amount, 'USD', 'en-US')).toEqual(expected);
  });
});
