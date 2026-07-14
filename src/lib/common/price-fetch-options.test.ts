import { buildSessionPricingScopeKey } from './price-fetch-options';

describe('buildSessionPricingScopeKey', () => {
  it('builds a pricing scope key that changes on login and company switch', () => {
    expect(
      buildSessionPricingScopeKey({
        siteCode: 'main',
        currency: 'EUR',
        customerId: 'ANONYMOUS',
      }),
    ).toBe('main|EUR|anonymous|');

    expect(
      buildSessionPricingScopeKey({
        siteCode: 'main',
        currency: 'EUR',
        customerId: '41535415',
        legalEntityId: '68622659f812a728c0bad17f',
      }),
    ).toBe('main|EUR|41535415|68622659f812a728c0bad17f');
  });

  it('returns an empty string when site or currency is missing', () => {
    expect(buildSessionPricingScopeKey({ siteCode: 'main', currency: '', customerId: '41535415' })).toBe('');
    expect(buildSessionPricingScopeKey(null)).toBe('');
  });
});
