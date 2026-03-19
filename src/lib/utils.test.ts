import { LocalizedString } from '@/platform/services/model/common';
import { formatCurrency, formatCurrencyToParts, l10n } from './utils';

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

  describe('LocalizedString object format', () => {
    const localizedObject: LocalizedString = {
      de: 'Text in Deutsch',
      en: 'Message in English',
    };

    it('should return correct translation for existing locale', () => {
      expect(l10n(localizedObject, 'de')).toBe('Text in Deutsch');
      expect(l10n(localizedObject, 'en')).toBe('Message in English');
    });

    it('should return first available value for non-existing locale', () => {
      // Since object iteration order is not guaranteed, we test that it returns one of the available values
      const result = l10n(localizedObject, 'fr');
      expect(['Text in Deutsch', 'Message in English']).toContain(result);
    });

    it('should handle single locale object', () => {
      const singleLocale: LocalizedString = { en: 'English only' };
      expect(l10n(singleLocale, 'en')).toBe('English only');
      expect(l10n(singleLocale, 'de')).toBe('English only');
    });

    it('should return empty string for empty object', () => {
      const emptyObject: LocalizedString = {};
      expect(l10n(emptyObject, 'en')).toBe('');
    });

    it('should handle object with multiple locales', () => {
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
  });

  describe('array format with language/message objects', () => {
    const arrayFormat = [
      { language: 'de', message: 'Text in Deutsch' },
      { language: 'en', message: 'Message in English' },
    ];

    it('should handle array format with correct locale', () => {
      expect(l10n(arrayFormat, 'en')).toBe('Message in English');
      expect(l10n(arrayFormat, 'de')).toBe('Text in Deutsch');
    });

    it('should fallback to first available message for non-existing locale', () => {
      const result = l10n(arrayFormat, 'fr');
      expect(['Text in Deutsch', 'Message in English']).toContain(result);
    });

    it('should return empty string for empty array', () => {
      const emptyArray: any[] = [];
      expect(l10n(emptyArray, 'en')).toBe('');
    });

    it('should handle malformed array items gracefully', () => {
      const malformedArray = [
        null,
        { language: 'en' }, // missing message
        { message: 'No language' }, // missing language
        { language: 'de', message: 'Valid German' },
        'invalid string item',
        undefined,
      ];

      expect(l10n(malformedArray, 'de')).toBe('Valid German');
      expect(l10n(malformedArray, 'fr')).toBe('Valid German'); // fallback to first valid
    });

    it('should handle array with no valid items', () => {
      const invalidArray = [
        null,
        undefined,
        { language: 'en' }, // missing message
        { message: 'No language' }, // missing language
        'string',
        123,
      ];

      expect(l10n(invalidArray, 'en')).toBe('');
    });

    it('should handle array with non-string messages gracefully', () => {
      const arrayWithNonStringMessages = [
        { language: 'en', message: null },
        { language: 'de', message: 123 },
        { language: 'fr', message: 'Valid French' },
      ];

      expect(l10n(arrayWithNonStringMessages, 'en')).toBe('Valid French'); // fallback to first valid string
      expect(l10n(arrayWithNonStringMessages, 'fr')).toBe('Valid French');
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

    it('should handle case-sensitive locale keys', () => {
      const localizedObject: LocalizedString = {
        EN: 'UPPERCASE English',
        en: 'lowercase english',
      };

      expect(l10n(localizedObject, 'EN')).toBe('UPPERCASE English');
      expect(l10n(localizedObject, 'en')).toBe('lowercase english');
      // Case mismatch should fall back to first available
      const result = l10n(localizedObject, 'En');
      expect(['UPPERCASE English', 'lowercase english']).toContain(result);
    });

    it('should handle objects with non-string values gracefully', () => {
      const invalidObject = {
        en: 'Valid string',
        de: null,
        fr: undefined,
        es: 123,
      } as any;

      expect(l10n(invalidObject, 'en')).toBe('Valid string');
      // For invalid values, the function should now fallback to first valid string
      expect(l10n(invalidObject, 'de')).toBe('Valid string');
      expect(l10n(invalidObject, 'es')).toBe('Valid string');
    });

    it('should handle completely invalid input types gracefully', () => {
      expect(l10n(123 as any, 'en')).toBe('');
      expect(l10n(true as any, 'en')).toBe('');
      expect(l10n(Symbol('test') as any, 'en')).toBe('');
      expect(l10n(() => 'function' as any, 'en')).toBe('');
    });

    it('should handle objects that throw errors during processing', () => {
      const problematicObject = {
        get en() {
          throw new Error('Property access error');
        },
        de: 'German text',
      };

      // Should fail gracefully and return empty string
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

      // Should fail gracefully and return empty string
      expect(l10n(problematicArray as any, 'en')).toBe('');
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

  it('uses de fallback when locale is omitted', () => {
    const amount = 1234.5;
    const expected = new Intl.NumberFormat('de', {
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
