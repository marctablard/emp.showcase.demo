import { appendSearchFilters } from './append-search-filters';

describe('appendSearchFilters', () => {
  it('appends scalar, array, and nested filter values', () => {
    const url = new URL('http://localhost/api/search');

    appendSearchFilters(url, {
      brand: 'Acme',
      color: ['red', 'blue'],
      price: { from: '10', till: '20' },
    });

    expect(url.searchParams.get('filters[brand]')).toBe('Acme');
    expect(url.searchParams.getAll('filters[color][]')).toEqual(['red', 'blue']);
    expect(url.searchParams.get('filters[price][from]')).toBe('10');
    expect(url.searchParams.get('filters[price][till]')).toBe('20');
  });

  it('skips empty filter maps', () => {
    const url = new URL('http://localhost/api/search');
    appendSearchFilters(url, undefined);
    expect(url.search).toBe('');
  });
});
