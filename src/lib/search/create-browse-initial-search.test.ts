import { createBrowseInitialSearch } from './create-browse-initial-search';

describe('createBrowseInitialSearch', () => {
  it('leaves sort undefined when the URL has no sort', () => {
    const { initialSearch, q } = createBrowseInitialSearch({}, 'main', 'de');

    expect(initialSearch.sort).toBeUndefined();
    expect(initialSearch.page).toBe(0);
    expect(initialSearch.size).toBe(12);
    expect(initialSearch.query).toBeUndefined();
    expect(initialSearch.filters).toBeUndefined();
    expect(initialSearch.segmentIds).toBeUndefined();
    expect(initialSearch.site).toBe('main');
    expect(initialSearch.locale).toBe('de');
    expect(q).toBeUndefined();
  });

  it('sets sort to the price:asc token from the URL', () => {
    const { initialSearch } = createBrowseInitialSearch({ sort: 'price:asc' }, 'main', 'en');

    expect(initialSearch.sort).toBe('price:asc');
  });

  it('keeps filters and sort together', () => {
    const { initialSearch } = createBrowseInitialSearch(
      {
        sort: 'price:asc',
        'filters[color]': 'red',
        q: 'drill',
      },
      'main',
      'de',
    );

    expect(initialSearch.sort).toBe('price:asc');
    expect(initialSearch.filters).toEqual({ color: 'red' });
    expect(initialSearch.query).toBe('drill');
    expect(initialSearch.segmentIds).toBeUndefined();
    expect(initialSearch.site).toBe('main');
    expect(initialSearch.locale).toBe('de');
  });

  it('uses the first string when sort is an array', () => {
    const { initialSearch } = createBrowseInitialSearch({ sort: ['price:desc', 'name:asc'] }, 'main', 'en');

    expect(initialSearch.sort).toBe('price:desc');
  });

  it('uses the first string when q, page, and size are repeated URL params', () => {
    const { initialSearch, q } = createBrowseInitialSearch(
      { q: ['drill', 'saw'], page: ['2', '9'], size: ['24', '6'] },
      'main',
      'de',
    );

    expect(q).toBe('drill');
    expect(initialSearch.query).toBe('drill');
    expect(initialSearch.page).toBe(2);
    expect(initialSearch.size).toBe(24);
  });

  describe('with a segment scope (assigned products mode)', () => {
    const scope = { segmentIds: ['seg-1', 'seg-2'], allowedCategoryIds: ['inside'] };

    it('sets segmentIds to the given ids', () => {
      const { initialSearch } = createBrowseInitialSearch({}, 'main', 'de', scope);

      expect(initialSearch.segmentIds).toEqual(['seg-1', 'seg-2']);
      expect(initialSearch.filters).toBeUndefined();
    });

    it('drops categoryIds outside the allowed scope and keeps the ones inside', () => {
      const { initialSearch } = createBrowseInitialSearch(
        { 'filters[categoryIds]': ['outside', 'inside'], 'filters[color]': 'red' },
        'main',
        'de',
        scope,
      );

      expect(initialSearch.filters).toEqual({ categoryIds: ['inside'], color: 'red' });
    });

    it('removes the categoryIds filter entirely when only out-of-scope ids were requested', () => {
      const { initialSearch } = createBrowseInitialSearch({ 'filters[categoryIds]': 'outside' }, 'main', 'de', scope);

      expect(initialSearch.filters).toBeUndefined();
    });

    it('keeps q, page, size and sort parsing unchanged', () => {
      const { initialSearch, q } = createBrowseInitialSearch(
        { q: 'drill', page: '2', size: '24', sort: 'price:asc' },
        'main',
        'en',
        scope,
      );

      expect(q).toBe('drill');
      expect(initialSearch.query).toBe('drill');
      expect(initialSearch.page).toBe(2);
      expect(initialSearch.size).toBe(24);
      expect(initialSearch.sort).toBe('price:asc');
      expect(initialSearch.segmentIds).toEqual(['seg-1', 'seg-2']);
      expect(initialSearch.site).toBe('main');
      expect(initialSearch.locale).toBe('en');
    });
  });

  it('leaves categoryIds filters untouched without a scope', () => {
    const { initialSearch } = createBrowseInitialSearch({ 'filters[categoryIds]': 'outside' }, 'main', 'de');

    expect(initialSearch.filters).toEqual({ categoryIds: 'outside' });
    expect(initialSearch.segmentIds).toBeUndefined();
  });
});
