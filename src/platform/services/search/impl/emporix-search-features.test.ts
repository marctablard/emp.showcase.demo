import type { Category } from '@/platform/services/model/category';
import type { Product } from '@/platform/services/model/product';
import {
  applyPriceWindow,
  applySelectiveCriteria,
  buildCategorySuggestions,
  buildEmporixCatalogFacets,
  buildQueryCompletions,
  partitionRelatedItems,
  readSelectiveFilters,
  resolveEmporixSort,
} from './emporix-search-features';

describe('emporix-search-features', () => {
  it('maps name and BatteryIncluded price tokens and drops unknown sort fields', () => {
    expect(resolveEmporixSort('name:desc')).toEqual({ productSort: 'name:desc' });
    expect(resolveEmporixSort('_product_i18n.{locale}.name:asc')).toEqual({ productSort: 'name:asc' });
    expect(
      resolveEmporixSort(
        '_product_siteAware.{siteAware}.currencyAware.{currencyAware}.countryAware.{countryAware}.price.effectiveAmount:desc',
      ),
    ).toEqual({ priceDirection: 'desc' });
    expect(resolveEmporixSort('not-a-field:asc')).toEqual({});
  });

  it('reads brand, attribute, and price filters into Product Service criteria', () => {
    const selective = readSelectiveFilters({
      categoryIds: ['cat-1'],
      brandId: ['brand-a', 'brand-b'],
      'attr:color': 'Red',
      price: { from: '10', till: '40' },
      '_product.published': 'true',
    });

    expect(selective).toEqual({
      brandIds: ['brand-a', 'brand-b'],
      attributes: { color: ['Red'] },
      priceMin: 10,
      priceMax: 40,
    });
    expect(applySelectiveCriteria({ categoryIds: '(cat-1)' }, selective)).toEqual({
      categoryIds: '(cat-1)',
      brandId: '(brand-a,brand-b)',
      'mixins.productTemplateAttributes.color': '(Red)',
    });
  });

  it('builds brand and price facets and sorts a price window', () => {
    const products: Product[] = [
      {
        id: 'a',
        name: 'Alpha',
        description: '',
        purchasable: true,
        brand: { id: 'brand-a', name: 'Alpha Brand' },
        price: {
          id: 'p1',
          productId: 'a',
          amount: 30,
          currency: 'EUR',
          discountValue: 0,
          discountPercentage: 0,
          totalValue: 30,
          quantity: { quantity: 1 },
          includesTax: false,
          tierValues: [],
        },
        templateAttributes: { color: 'Red' },
      },
      {
        id: 'b',
        name: 'Beta',
        description: '',
        purchasable: true,
        brand: { id: 'brand-b', name: 'Beta Brand' },
        price: {
          id: 'p2',
          productId: 'b',
          amount: 10,
          currency: 'EUR',
          discountValue: 0,
          discountPercentage: 0,
          totalValue: 10,
          quantity: { quantity: 1 },
          includesTax: false,
          tierValues: [],
        },
        templateAttributes: { color: 'Blue' },
      },
    ];

    const facets = buildEmporixCatalogFacets(products, { brandId: 'brand-b' }, 'en', true);
    const brand = facets.batteryIncludedFacets.find((facet) => facet.id === 'brandId');
    const price = facets.batteryIncludedFacets.find((facet) => facet.id === 'price');
    expect(brand).toEqual(
      expect.objectContaining({
        kind: 'select',
        options: [
          expect.objectContaining({ id: 'brand-a', label: 'Alpha Brand', count: 1, active: false }),
          expect.objectContaining({ id: 'brand-b', label: 'Beta Brand', count: 1, active: true }),
        ],
      }),
    );
    expect(price).toEqual(expect.objectContaining({ kind: 'range', min: '10', max: '30' }));

    const paged = applyPriceWindow(products, { brandIds: [], attributes: {}, priceMin: 20 }, 'asc', 0, 12);
    expect(paged.total).toBe(1);
    expect(paged.items.map((product) => product.id)).toEqual(['a']);
  });

  it('builds query completions and category suggestions that carry a category id', () => {
    const products: Product[] = [
      { id: 'a', name: { en: 'Solar panel' }, description: '', purchasable: true },
      { id: 'b', name: { en: 'Drill' }, description: '', purchasable: true },
    ];
    expect(buildQueryCompletions(products, 'sol', 'en')).toEqual(['Solar panel']);

    const roots: Category[] = [
      {
        id: 'root',
        name: { en: 'Home' },
        children: [{ id: 'solar', name: { en: 'Solar panels' } }],
      },
    ];
    expect(buildCategorySuggestions(roots, 'solar', 'en')).toEqual([
      {
        name: 'Solar panels',
        highlighted: '<mark>Solar</mark> panels',
        count: 0,
        categoryId: 'solar',
        idPath: 'solar',
      },
    ]);
  });

  it('splits related items into cross-sell and upsell ids', () => {
    expect(
      partitionRelatedItems([
        { refId: 'acc', type: 'Accessory' },
        { refId: 'up', type: 'Upsell' },
        { refId: ' ', type: 'Similar' },
      ]),
    ).toEqual({ crossSellIds: ['acc'], upSellIds: ['up'] });
  });
});
