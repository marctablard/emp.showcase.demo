import { appendSiteQuery, buildClientFetchScope, requestSiteFromClientDedupeScope } from './client-fetch-scope';

describe('buildClientFetchScope', () => {
  it('joins mode, site and customer, omitting empty extra', () => {
    expect(buildClientFetchScope({ mode: 'assigned', siteCode: 'main', customerId: 'c-1' })).toBe('assigned:main:c-1');
  });

  it('appends extra when present and treats missing fields as empty', () => {
    expect(buildClientFetchScope({ extra: 'USD' })).toBe(':::USD');
    expect(buildClientFetchScope({})).toBe('::');
  });
});

describe('requestSiteFromClientDedupeScope', () => {
  it('reads the site from a standard mode:site:customer key', () => {
    expect(requestSiteFromClientDedupeScope('assigned:us:c-1')).toBe('us');
    expect(requestSiteFromClientDedupeScope('assigned:us:c-1:EUR')).toBe('us');
    expect(requestSiteFromClientDedupeScope('anonymous::')).toBeUndefined();
  });

  it('reads the site from a last-seen validation key', () => {
    expect(requestSiteFromClientDedupeScope('products-mode-validation:assigned:main:c-1:p-1')).toBe('main');
  });
});

describe('appendSiteQuery', () => {
  it('adds or skips the site query param', () => {
    expect(appendSiteQuery('/api/products/p-1/variants', 'us')).toBe('/api/products/p-1/variants?site=us');
    expect(appendSiteQuery('/api/products/p-1?prices=true', 'us')).toBe('/api/products/p-1?prices=true&site=us');
    expect(appendSiteQuery('/api/products/p-1/variants', '')).toBe('/api/products/p-1/variants');
  });
});
