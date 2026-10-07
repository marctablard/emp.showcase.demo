import { cacheRules } from './cache-config';

const PRODUCT_HTML_URL = '/product/(.*)';
const PRODUCT_PRICE_URL = '/api/products/(.*)/price';
const PRODUCT_CATALOG_URL = '/api/products/(.*)';

describe('cacheRules', () => {
  const ruleIndex = (url: string) => cacheRules.findIndex((rule) => rule.url === url);
  const ruleFor = (url: string) => cacheRules.find((rule) => rule.url === url);

  it('keeps /api/products/(.*)/price at revalidate 0 before the catalog catch-all', () => {
    const priceIndex = ruleIndex(PRODUCT_PRICE_URL);
    const catalogIndex = ruleIndex(PRODUCT_CATALOG_URL);

    expect(ruleFor(PRODUCT_PRICE_URL)?.cache?.revalidate).toBe(0);
    expect(priceIndex).toBeGreaterThanOrEqual(0);
    expect(catalogIndex).toBeGreaterThan(priceIndex);
  });

  it('sets /api/products/(.*) catalog catch-all to revalidate 0', () => {
    expect(ruleFor(PRODUCT_CATALOG_URL)?.cache?.revalidate).toBe(0);
  });

  it('sets /product/(.*) to revalidate 0 so the middleware emits private, no-store', () => {
    expect(ruleFor(PRODUCT_HTML_URL)).toEqual({
      url: PRODUCT_HTML_URL,
      cache: {
        revalidate: 0,
        tags: ['product-$1'],
      },
    });
  });

  it('sets /api/search and its subpaths to revalidate 0 so listing prices are not publicly cached', () => {
    const pattern = '/api/search(?:/.*)?';
    expect(ruleFor(pattern)?.cache?.revalidate).toBe(0);
    const regex = new RegExp(`^${pattern}$`);
    expect(regex.test('/api/search')).toBe(true);
    expect(regex.test('/api/search/suggestions')).toBe(true);
    expect(regex.test('/api/searching')).toBe(false);
  });
});
