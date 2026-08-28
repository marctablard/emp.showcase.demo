import { createBrowseInitialSearch } from './create-browse-initial-search';

describe('createBrowseInitialSearch', () => {
  it('leaves sort undefined when the URL has no sort', () => {
    const { initialSearch, q } = createBrowseInitialSearch({}, false, 'main', 'de');

    expect(initialSearch.sort).toBeUndefined();
    expect(initialSearch.page).toBe(0);
    expect(initialSearch.size).toBe(12);
    expect(initialSearch.query).toBeUndefined();
    expect(initialSearch.filters).toBeUndefined();
    expect(initialSearch.customerSegments).toBe(false);
    expect(initialSearch.site).toBe('main');
    expect(initialSearch.locale).toBe('de');
    expect(q).toBeUndefined();
  });

  it('sets sort to the price:asc token from the URL', () => {
    const { initialSearch } = createBrowseInitialSearch({ sort: 'price:asc' }, false, 'main', 'en');

    expect(initialSearch.sort).toBe('price:asc');
  });

  it('keeps filters and sort together', () => {
    const { initialSearch } = createBrowseInitialSearch(
      {
        sort: 'price:asc',
        'filters[color]': 'red',
        q: 'drill',
      },
      true,
      'main',
      'de',
    );

    expect(initialSearch.sort).toBe('price:asc');
    expect(initialSearch.filters).toEqual({ color: 'red' });
    expect(initialSearch.query).toBe('drill');
    expect(initialSearch.customerSegments).toBe(true);
    expect(initialSearch.site).toBe('main');
    expect(initialSearch.locale).toBe('de');
  });

  it('uses the first string when sort is an array', () => {
    const { initialSearch } = createBrowseInitialSearch({ sort: ['price:desc', 'name:asc'] }, false, 'main', 'en');

    expect(initialSearch.sort).toBe('price:desc');
  });
});
