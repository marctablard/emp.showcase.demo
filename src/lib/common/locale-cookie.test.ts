/**
 * COP-5852 tenant snapshot from GET http://localhost:3000/api/site/us-branch (2026-08-17):
 * - languages: ["en"]
 * - currencies: USD, CHF
 * - defaultLanguage: "en"
 * - defaultCurrency: USD
 * US does not list `de` or EUR; both locale and currency seams remain in scope.
 */
import {
  LOCALE_ALIGN_QUERY_PARAM,
  appendLocaleAlignParam,
  getLocaleCookieName,
  parseLocaleAlignParam,
  writeLocaleCookie,
} from './locale-cookie';

const ALLOWED_LOCALES = ['en', 'de'] as const;

describe('getLocaleCookieName', () => {
  const original = process.env.NEXT_PUBLIC_LOCALE_COOKIE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_LOCALE_COOKIE;
    } else {
      process.env.NEXT_PUBLIC_LOCALE_COOKIE = original;
    }
  });

  it('returns NEXT_LOCALE when the env var is missing', () => {
    delete process.env.NEXT_PUBLIC_LOCALE_COOKIE;

    expect(getLocaleCookieName()).toBe('NEXT_LOCALE');
  });

  it('returns NEXT_LOCALE when the env var is blank', () => {
    process.env.NEXT_PUBLIC_LOCALE_COOKIE = '   ';

    expect(getLocaleCookieName()).toBe('NEXT_LOCALE');
  });

  it('returns the configured name when the env var is set', () => {
    process.env.NEXT_PUBLIC_LOCALE_COOKIE = 'EMP_LOCALE';

    expect(getLocaleCookieName()).toBe('EMP_LOCALE');
  });

  it('trims the configured name', () => {
    process.env.NEXT_PUBLIC_LOCALE_COOKIE = '  EMP_LOCALE  ';

    expect(getLocaleCookieName()).toBe('EMP_LOCALE');
  });
});

describe('writeLocaleCookie', () => {
  const originalEnv = process.env.NEXT_PUBLIC_LOCALE_COOKIE;
  const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_LOCALE_COOKIE;
    } else {
      process.env.NEXT_PUBLIC_LOCALE_COOKIE = originalEnv;
    }
    if (originalDocumentDescriptor === undefined) {
      Reflect.deleteProperty(globalThis, 'document');
    } else {
      Object.defineProperty(globalThis, 'document', originalDocumentDescriptor);
    }
  });

  it('no-ops when document is undefined', () => {
    Reflect.deleteProperty(globalThis, 'document');

    expect(() => writeLocaleCookie('de')).not.toThrow();
    expect(globalThis.document).toBeUndefined();
  });

  it('sets Path=/; SameSite=Lax for NEXT_LOCALE when the env var is unset', () => {
    delete process.env.NEXT_PUBLIC_LOCALE_COOKIE;
    const cookieHolder = { value: '' };
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        get cookie() {
          return cookieHolder.value;
        },
        set cookie(next: string) {
          cookieHolder.value = next;
        },
      },
    });

    writeLocaleCookie('en');

    expect(cookieHolder.value).toContain('NEXT_LOCALE=en');
    expect(cookieHolder.value).toContain('Path=/');
    expect(cookieHolder.value).toContain('SameSite=Lax');
  });

  it('uses the configured cookie name when set', () => {
    process.env.NEXT_PUBLIC_LOCALE_COOKIE = 'EMP_LOCALE';
    const cookieHolder = { value: '' };
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        get cookie() {
          return cookieHolder.value;
        },
        set cookie(next: string) {
          cookieHolder.value = next;
        },
      },
    });

    writeLocaleCookie('de');

    expect(cookieHolder.value).toContain('EMP_LOCALE=de');
    expect(cookieHolder.value).toContain('Path=/');
    expect(cookieHolder.value).toContain('SameSite=Lax');
  });
});

describe('LOCALE_ALIGN_QUERY_PARAM', () => {
  it('is emp_locale', () => {
    expect(LOCALE_ALIGN_QUERY_PARAM).toBe('emp_locale');
  });
});

describe('appendLocaleAlignParam', () => {
  it('appends emp_locale to a path without a query string', () => {
    expect(appendLocaleAlignParam('/us-branch', 'en')).toBe('/us-branch?emp_locale=en');
  });

  it('appends emp_locale to a path that already has query params', () => {
    expect(appendLocaleAlignParam('/us-branch?foo=bar', 'en')).toBe('/us-branch?foo=bar&emp_locale=en');
  });

  it('preserves a hash fragment', () => {
    expect(appendLocaleAlignParam('/us-branch#top', 'en')).toBe('/us-branch?emp_locale=en#top');
  });
});

describe('parseLocaleAlignParam', () => {
  it('returns the value when it is in the caller-supplied allow-list', () => {
    expect(parseLocaleAlignParam('en', ALLOWED_LOCALES)).toBe('en');
    expect(parseLocaleAlignParam('de', ALLOWED_LOCALES)).toBe('de');
  });

  it('rejects values that are not in the allow-list', () => {
    expect(parseLocaleAlignParam('fr', ALLOWED_LOCALES)).toBeUndefined();
    expect(parseLocaleAlignParam('not-a-locale', ALLOWED_LOCALES)).toBeUndefined();
  });

  it('rejects missing, empty, and non-string-adjacent empties', () => {
    expect(parseLocaleAlignParam(null, ALLOWED_LOCALES)).toBeUndefined();
    expect(parseLocaleAlignParam(undefined, ALLOWED_LOCALES)).toBeUndefined();
    expect(parseLocaleAlignParam('', ALLOWED_LOCALES)).toBeUndefined();
  });
});
