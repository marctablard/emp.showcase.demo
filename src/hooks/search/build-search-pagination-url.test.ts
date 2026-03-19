import { buildSearchPaginationUrl } from './build-search-pagination-url';

describe('buildSearchPaginationUrl', () => {
  it('builds search url with required pagination and context params', () => {
    const url = buildSearchPaginationUrl({
      origin: 'https://example.com',
      nextPage: 2,
      pageSize: 16,
      siteCode: 'main',
      locale: 'en',
    });

    expect(url.pathname).toBe('/api/search');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('size')).toBe('16');
    expect(url.searchParams.get('site')).toBe('main');
    expect(url.searchParams.get('locale')).toBe('en');
    expect(url.searchParams.get('query')).toBeNull();
    expect(url.searchParams.get('sort')).toBeNull();
  });

  it('includes optional query and sort when provided', () => {
    const url = buildSearchPaginationUrl({
      origin: 'https://example.com',
      nextPage: 1,
      pageSize: 24,
      siteCode: 'demo-site',
      locale: 'de',
      query: 'cordless drill',
      sort: 'price-desc',
    });

    expect(url.searchParams.get('query')).toBe('cordless drill');
    expect(url.searchParams.get('sort')).toBe('price-desc');
  });

  it('omits empty optional query and sort', () => {
    const url = buildSearchPaginationUrl({
      origin: 'https://example.com',
      nextPage: 3,
      pageSize: 12,
      siteCode: 'main',
      locale: 'en',
      query: '',
      sort: '',
    });

    expect(url.searchParams.get('query')).toBeNull();
    expect(url.searchParams.get('sort')).toBeNull();
  });
});
