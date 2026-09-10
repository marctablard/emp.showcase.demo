import de from '@/i18n/translations/de/account/index.json';
import en from '@/i18n/translations/en/account/index.json';
import { RETURN_ERROR_CODE } from './return-error-codes';

/**
 * The codes are resolved at runtime, so `check-translations` cannot see them and a key missing
 * in one language would only surface in production. These cases close that gap.
 */
describe('return error codes', () => {
  const codes = Object.values(RETURN_ERROR_CODE).sort();

  it.each([
    ['de', de.returns.apiError],
    ['en', en.returns.apiError],
  ])('has a %s message for every code, and no message without a code', (_locale, messages) => {
    expect(Object.keys(messages).sort()).toEqual(codes);
  });

  it.each([
    ['de', de.returns.apiError],
    ['en', en.returns.apiError],
  ])('has no empty %s message', (_locale, messages) => {
    for (const [code, text] of Object.entries(messages)) {
      expect(`${code}: ${String(text).trim()}`).not.toBe(`${code}: `);
    }
  });

  it('keeps the placeholders of both languages in sync', () => {
    const placeholders = (text: string) => (text.match(/\{(\w+)\}/g) ?? []).sort();

    for (const code of codes) {
      const key = code as keyof typeof de.returns.apiError;
      expect(`${code} ${placeholders(de.returns.apiError[key])}`).toBe(
        `${code} ${placeholders(en.returns.apiError[key])}`,
      );
    }
  });
});
