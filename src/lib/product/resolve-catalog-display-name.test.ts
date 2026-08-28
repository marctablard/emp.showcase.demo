import { resolveCatalogDisplayName } from './resolve-catalog-display-name';

describe('resolveCatalogDisplayName', () => {
  it('returns a plain string name as-is for any locale', () => {
    const name = 'Parent variant';

    expect(resolveCatalogDisplayName(name, 'de')).toBe('Parent variant');
    expect(resolveCatalogDisplayName(name, 'en')).toBe('Parent variant');
    expect(resolveCatalogDisplayName(name, 'fr')).toBe('Parent variant');
  });

  it('returns the matching locale from a locale map with or without fallback', () => {
    const name = { de: 'Variant DE', en: 'Parent EN' };

    expect(resolveCatalogDisplayName(name, 'de')).toBe('Variant DE');
    expect(resolveCatalogDisplayName(name, 'de', 'en')).toBe('Variant DE');
  });

  it('returns the site fallback when the session locale is missing', () => {
    const name = { en: 'Parent EN' };

    expect(resolveCatalogDisplayName(name, 'de', 'en')).toBe('Parent EN');
  });
});
