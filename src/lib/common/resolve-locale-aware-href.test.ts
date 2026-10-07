import { resolveLocaleAwareHref } from './resolve-locale-aware-href';

describe('resolveLocaleAwareHref', () => {
  it('prefixes the current non-default locale when nextLocale is omitted', () => {
    const path = resolveLocaleAwareHref('/browse?q=pump', 'de');

    expect(path).toContain('/de/browse');
    expect(path).toContain('q=pump');
  });

  it('does not prefix the default locale when nextLocale is omitted', () => {
    const path = resolveLocaleAwareHref('/browse?q=pump', 'en');

    expect(path).not.toContain('/en');
    expect(path).toContain('/browse');
    expect(path).toContain('q=pump');
  });

  it('force-prefixes when the caller requests a different locale', () => {
    const path = resolveLocaleAwareHref('/browse', 'en', 'de');

    expect(path).toContain('/de/browse');
  });

  it('does not emit /en when nextLocale matches the default current locale', () => {
    const path = resolveLocaleAwareHref('/browse', 'en', 'en');

    expect(path).not.toContain('/en');
    expect(path).toBe('/browse');
  });
});
