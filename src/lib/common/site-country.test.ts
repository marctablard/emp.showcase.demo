import { normalizeCountryCode, resolveCountryForSite, siteAllowsCountry } from './site-country';

const fwSite = {
  defaultCountry: 'CH',
  countries: [{ code: 'CH' }, { code: 'DE' }],
  shipToCountries: [{ code: 'AT' }],
};

describe('normalizeCountryCode', () => {
  it('trims and uppercases ISO country codes', () => {
    expect(normalizeCountryCode(' ch ')).toBe('CH');
    expect(normalizeCountryCode('de')).toBe('DE');
    expect(normalizeCountryCode('')).toBe('');
    expect(normalizeCountryCode(undefined)).toBe('');
  });
});

describe('resolveCountryForSite', () => {
  it('keeps the current country when the site lists it', () => {
    expect(resolveCountryForSite(fwSite, 'de')).toBe('DE');
    expect(resolveCountryForSite(fwSite, 'AT')).toBe('AT');
  });

  it('uses the site default when the current country is empty or not allowed', () => {
    expect(resolveCountryForSite(fwSite, undefined)).toBe('CH');
    expect(resolveCountryForSite(fwSite, '')).toBe('CH');
    expect(resolveCountryForSite(fwSite, 'RO')).toBe('CH');
  });

  it('keeps a set country when the site has no country lists', () => {
    expect(resolveCountryForSite({ defaultCountry: 'CH' }, 'DE')).toBe('DE');
    expect(siteAllowsCountry({ defaultCountry: 'CH' }, 'DE')).toBe(true);
  });

  it('fills an empty country from site.defaultCountry even without lists', () => {
    expect(resolveCountryForSite({ defaultCountry: 'CH' }, undefined)).toBe('CH');
  });
});
