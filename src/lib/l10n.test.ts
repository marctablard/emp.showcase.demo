import { LocalizedString } from '@/platform/services/model/common';
import { L10N_MISSING_LABEL, l10n, l10nOrEmpty, resolveLocalizedString } from './l10n';

describe('l10n', () => {
  describe('null and undefined handling', () => {
    it('returns empty string for null input', () => {
      expect(l10n(null as never, 'en')).toBe('');
    });

    it('returns empty string for undefined input', () => {
      expect(l10n(undefined as never, 'en')).toBe('');
    });

    it('returns empty string for empty string input', () => {
      expect(l10n('', 'en')).toBe('');
    });
  });

  describe('normal string input', () => {
    it('returns the same string when input is a normal string', () => {
      const input = 'Hello World';
      expect(l10n(input, 'en')).toBe('Hello World');
      expect(l10n(input, 'de')).toBe('Hello World');
      expect(l10n(input, 'fr')).toBe('Hello World');
    });

    it('handles strings with special characters', () => {
      const input = 'Héllo Wörld! 🌍';
      expect(l10n(input, 'en')).toBe('Héllo Wörld! 🌍');
    });
  });

  describe('LocalizedString object format', () => {
    const localizedObject: LocalizedString = {
      de: 'Text in Deutsch',
      en: 'Message in English',
    };

    it('returns correct translation for existing locale', () => {
      expect(l10n(localizedObject, 'de')).toBe('Text in Deutsch');
      expect(l10n(localizedObject, 'en')).toBe('Message in English');
    });

    it('falls back to routing defaultLocale when locale is missing', () => {
      expect(l10n(localizedObject, 'fr')).toBe('Message in English');
    });

    it('uses explicit defaultLocale when provided', () => {
      expect(l10n(localizedObject, 'fr', 'de')).toBe('Text in Deutsch');
    });

    it('handles single locale object for non-matching session locale via default', () => {
      const singleLocale: LocalizedString = { en: 'English only' };
      expect(l10n(singleLocale, 'en')).toBe('English only');
      expect(l10n(singleLocale, 'de')).toBe('English only');
    });

    it('returns missing label for empty object', () => {
      const emptyObject: LocalizedString = {};
      expect(l10n(emptyObject, 'en')).toBe(L10N_MISSING_LABEL);
    });

    it('handles object with multiple locales', () => {
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

    it('returns missing label when neither session nor default locale exist on object', () => {
      expect(l10n({ ja: '日本語' } as LocalizedString, 'en')).toBe(L10N_MISSING_LABEL);
    });
  });

  describe('array format with language/message objects', () => {
    const arrayFormat = [
      { language: 'de', message: 'Text in Deutsch' },
      { language: 'en', message: 'Message in English' },
    ];

    it('handles array format with correct locale', () => {
      expect(l10n(arrayFormat, 'en')).toBe('Message in English');
      expect(l10n(arrayFormat, 'de')).toBe('Text in Deutsch');
    });

    it('falls back to defaultLocale when locale is missing in array', () => {
      expect(l10n(arrayFormat, 'fr')).toBe('Message in English');
    });

    it('returns empty string for empty array', () => {
      const emptyArray: unknown[] = [];
      expect(l10n(emptyArray, 'en')).toBe('');
    });

    it('returns missing label when only unrelated locales exist', () => {
      const malformedArray = [
        null,
        { language: 'en' },
        { message: 'No language' },
        { language: 'de', message: 'Valid German' },
        'invalid string item',
        undefined,
      ];

      expect(l10n(malformedArray, 'de')).toBe('Valid German');
      expect(l10n(malformedArray, 'fr')).toBe(L10N_MISSING_LABEL);
    });

    it('returns missing label for array with no valid items', () => {
      const invalidArray = [null, undefined, { language: 'en' }, { message: 'No language' }, 'string', 123];

      expect(l10n(invalidArray, 'en')).toBe(L10N_MISSING_LABEL);
    });

    it('does not scan arbitrary languages when session and default miss', () => {
      const arrayWithNonStringMessages = [
        { language: 'en', message: null },
        { language: 'de', message: 123 },
        { language: 'fr', message: 'Valid French' },
      ];

      expect(l10n(arrayWithNonStringMessages, 'en')).toBe(L10N_MISSING_LABEL);
      expect(l10n(arrayWithNonStringMessages, 'fr')).toBe('Valid French');
    });
  });

  describe('edge cases', () => {
    it('handles locale parameter variations', () => {
      const localizedObject: LocalizedString = {
        'en-US': 'American English',
        'en-GB': 'British English',
        'de-DE': 'German',
      };

      expect(l10n(localizedObject, 'en-US')).toBe('American English');
      expect(l10n(localizedObject, 'en-GB')).toBe('British English');
      expect(l10n(localizedObject, 'de-DE')).toBe('German');
    });

    it('handles case-sensitive locale keys and default fallback', () => {
      const localizedObject: LocalizedString = {
        EN: 'UPPERCASE English',
        en: 'lowercase english',
      };

      expect(l10n(localizedObject, 'EN')).toBe('UPPERCASE English');
      expect(l10n(localizedObject, 'en')).toBe('lowercase english');
      expect(l10n(localizedObject, 'En')).toBe('lowercase english');
    });

    it('handles objects with non-string values via default locale', () => {
      const invalidObject = {
        en: 'Valid string',
        de: null,
        fr: undefined,
        es: 123,
      } as unknown as LocalizedString;

      expect(l10n(invalidObject, 'en')).toBe('Valid string');
      expect(l10n(invalidObject, 'de')).toBe('Valid string');
      expect(l10n(invalidObject, 'es')).toBe('Valid string');
    });

    it('handles completely invalid input types gracefully', () => {
      expect(l10n(123 as never, 'en')).toBe('');
      expect(l10n(true as never, 'en')).toBe('');
      expect(l10n(Symbol('test') as never, 'en')).toBe('');
      expect(l10n(() => 'function' as never, 'en')).toBe('');
    });

    it('handles objects that throw errors during processing', () => {
      const problematicObject = {
        get en() {
          throw new Error('Property access error');
        },
        de: 'German text',
      };

      expect(l10n(problematicObject as never, 'en')).toBe('');
    });

    it('handles arrays that throw errors during processing', () => {
      const problematicArray = [
        {
          get language() {
            throw new Error('Property access error');
          },
          message: 'Test',
        },
      ];

      expect(l10n(problematicArray as never, 'en')).toBe('');
    });
  });

  describe('l10nOrEmpty', () => {
    it('returns empty string instead of missing label', () => {
      expect(l10nOrEmpty({ ja: 'x' } as LocalizedString, 'en')).toBe('');
    });
  });

  describe('resolveLocalizedString', () => {
    it('aliases l10n with default routing defaultLocale', () => {
      expect(resolveLocalizedString({ en: 'A' }, 'en')).toBe('A');
    });
  });
});
