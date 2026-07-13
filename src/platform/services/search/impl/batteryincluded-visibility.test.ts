import {
  buildBatteryIncludedVisibilityFilters,
  buildBatteryIncludedVisibilityVariables,
  mergeBatteryIncludedVisibilityFilters,
} from './batteryincluded-visibility';

describe('batteryincluded-visibility', () => {
  it('builds the explicit published-root hard filter contract', () => {
    expect(buildBatteryIncludedVisibilityFilters([' root-a ', 'root-b', '', 'root-a '])).toEqual({
      '_product.published': 'true',
      '_product.categoryIds': ['root-a', 'root-b'],
    });
  });

  it('intersects caller category scope with the published roots and preserves other filters', () => {
    expect(
      mergeBatteryIncludedVisibilityFilters(
        {
          '_product.categoryIds': ['root-b', 'root-c'],
          brand: ['Acme'],
          price: { from: '10', till: '20' },
        },
        ['root-a', 'root-b'],
      ),
    ).toEqual({
      '_product.published': 'true',
      '_product.categoryIds': ['root-b'],
      brand: ['Acme'],
      price: { from: '10', till: '20' },
    });
  });

  it('fails closed when the caller category selection does not overlap the published roots', () => {
    expect(
      mergeBatteryIncludedVisibilityFilters(
        {
          '_product.categoryIds': ['root-c'],
          brand: 'Acme',
        },
        ['root-a', 'root-b'],
      ),
    ).toBeNull();
  });

  it('returns the standard BI visibility variables unchanged', () => {
    expect(
      buildBatteryIncludedVisibilityVariables({
        locale: 'en',
        site: 'main',
        country: 'DE',
        currency: 'EUR',
      }),
    ).toEqual({
      locale: 'en',
      siteAware: 'main',
      countryAware: 'DE',
      currencyAware: 'EUR',
    });
  });
});