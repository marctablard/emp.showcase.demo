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

  it('leaves /product/(.*) HTML cache rule unchanged', () => {
    expect(ruleFor(PRODUCT_HTML_URL)).toEqual({
      url: PRODUCT_HTML_URL,
      cache: {
        revalidate: 3600,
        tags: ['product-$1'],
      },
    });
  });
});
