import { BatteryIncludedFacetsQueryBuilder } from './BatteryIncludedFacetsQueryBuilder';

describe('BatteryIncludedFacetsQueryBuilder', () => {
  it('returns undefined when filters are missing', () => {
    expect(BatteryIncludedFacetsQueryBuilder.build(undefined)).toBeUndefined();
  });

  it('keeps scalar and repeated scalar filters unchanged aside from trimming blanks', () => {
    expect(
      BatteryIncludedFacetsQueryBuilder.build({
        color: ' red ',
        brand: [' Acme ', '', ' Contoso '],
      }),
    ).toEqual({
      color: 'red',
      brand: ['Acme', 'Contoso'],
    });
  });

  it('normalizes supported range keys only', () => {
    expect(
      BatteryIncludedFacetsQueryBuilder.build({
        price: {
          from: ' 10 ',
          till: ' 20 ',
        },
      }),
    ).toEqual({
      price: {
        from: '10',
        till: '20',
      },
    });
  });

  it('ignores malformed nested input safely', () => {
    expect(
      BatteryIncludedFacetsQueryBuilder.build({
        price: {
          from: ['10'],
          till: '',
          eq: '15',
        },
      }),
    ).toBeUndefined();
  });

  it('passes the category breadcrumb filter through unchanged', () => {
    expect(
      BatteryIncludedFacetsQueryBuilder.build({
        '_product_i18n.categoryBreadcrumbs.displayPath': ['Cables', 'Cables > USB-C'],
      }),
    ).toEqual({
      '_product_i18n.categoryBreadcrumbs.displayPath': ['Cables', 'Cables > USB-C'],
    });
  });
});
