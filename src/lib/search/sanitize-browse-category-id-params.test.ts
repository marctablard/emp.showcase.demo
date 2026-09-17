import { sanitizeBrowseCategoryIdParams } from './sanitize-browse-category-id-params';

describe('sanitizeBrowseCategoryIdParams', () => {
  const allowed = ['inside-1', 'inside-2'];

  it('returns undefined when no category filter is present (no redirect)', () => {
    expect(sanitizeBrowseCategoryIdParams({ q: 'drill', page: '2' }, allowed)).toBeUndefined();
    expect(sanitizeBrowseCategoryIdParams({}, allowed)).toBeUndefined();
  });

  it('returns undefined when every requested category id is inside the scope (no redirect)', () => {
    expect(sanitizeBrowseCategoryIdParams({ 'filters[categoryIds]': 'inside-1' }, allowed)).toBeUndefined();
    expect(
      sanitizeBrowseCategoryIdParams({ 'filters[categoryIds][]': ['inside-1', 'inside-2'] }, allowed),
    ).toBeUndefined();
  });

  it('drops the categoryIds key entirely when only out-of-scope ids were requested', () => {
    const result = sanitizeBrowseCategoryIdParams({ 'filters[categoryIds]': 'outside' }, allowed);

    expect(result).toEqual({ params: {}, droppedCategoryIds: ['outside'] });
    // An empty `params` serialises to an empty query, so the page redirects to `/browse` (never `/browse?`).
    expect(new URLSearchParams(result?.params as Record<string, string>).toString()).toBe('');
  });

  it('keeps only the inside ids of a mixed array value', () => {
    const result = sanitizeBrowseCategoryIdParams(
      { 'filters[categoryIds][]': ['outside-a', 'inside-2', 'outside-b', 'inside-1'] },
      allowed,
    );

    expect(result).toEqual({
      params: { 'filters[categoryIds][]': ['inside-2', 'inside-1'] },
      droppedCategoryIds: ['outside-a', 'outside-b'],
    });
  });

  it('preserves every other param in its original order and shape', () => {
    const result = sanitizeBrowseCategoryIdParams(
      {
        q: 'drill',
        'filters[categoryIds]': 'outside',
        page: '2',
        size: '24',
        sort: 'price:asc',
        'filters[color][]': ['red', 'blue'],
        'filters[price][min]': '10',
        currency: 'EUR',
      },
      allowed,
    );

    expect(result?.droppedCategoryIds).toEqual(['outside']);
    expect(Object.entries(result?.params ?? {})).toEqual([
      ['q', 'drill'],
      ['page', '2'],
      ['size', '24'],
      ['sort', 'price:asc'],
      ['filters[color][]', ['red', 'blue']],
      ['filters[price][min]', '10'],
      ['currency', 'EUR'],
    ]);
  });

  it('keeps the categoryIds key in place when some ids survive', () => {
    const result = sanitizeBrowseCategoryIdParams(
      { q: 'drill', 'filters[categoryIds][]': ['outside', 'inside-1'], page: '1' },
      allowed,
    );

    expect(Object.keys(result?.params ?? {})).toEqual(['q', 'filters[categoryIds][]', 'page']);
    expect(result?.params['filters[categoryIds][]']).toEqual(['inside-1']);
  });

  it('sanitises the legacy f[categoryIds] key as well', () => {
    const result = sanitizeBrowseCategoryIdParams({ 'f[categoryIds]': 'outside', 'f[color]': 'red' }, allowed);

    expect(result).toEqual({ params: { 'f[color]': 'red' }, droppedCategoryIds: ['outside'] });
  });

  it('deduplicates dropped ids across keys and accepts a ReadonlySet scope', () => {
    const result = sanitizeBrowseCategoryIdParams(
      { 'filters[categoryIds]': 'outside', 'filters[categoryIds][]': ['outside', 'inside-1'] },
      new Set(allowed),
    );

    expect(result).toEqual({
      params: { 'filters[categoryIds][]': ['inside-1'] },
      droppedCategoryIds: ['outside'],
    });
  });

  it('drops nested categoryIds keys such as filters[categoryIds][from] (AC5 URL redirect)', () => {
    const result = sanitizeBrowseCategoryIdParams(
      { q: 'drill', 'filters[categoryIds][from]': 'outside', 'filters[price][min]': '10' },
      allowed,
    );

    expect(result).toEqual({
      params: { q: 'drill', 'filters[price][min]': '10' },
      droppedCategoryIds: ['outside'],
    });
  });

  it('keeps a nested categoryIds key when its value is inside the scope', () => {
    expect(
      sanitizeBrowseCategoryIdParams({ 'filters[categoryIds][from]': 'inside-1', q: 'drill' }, allowed),
    ).toBeUndefined();
  });

  it('drops everything when the scope is empty (fail closed)', () => {
    const result = sanitizeBrowseCategoryIdParams({ 'filters[categoryIds][]': ['a', 'b'], q: 'x' }, []);

    expect(result).toEqual({ params: { q: 'x' }, droppedCategoryIds: ['a', 'b'] });
  });
});
