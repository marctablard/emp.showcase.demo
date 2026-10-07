import { hasCategoryIdsFilter, sanitizeCategoryFilters } from '@/lib/search/sanitize-category-filters';
import type { SearchFilters } from '@/platform/services/model/common';

describe('sanitizeCategoryFilters', () => {
  const allowed = new Set(['cat-a', 'cat-b']);

  it('removes the categoryIds key when a string value is outside the allowed set', () => {
    const filters: SearchFilters = { categoryIds: 'cat-x', brand: 'acme' };

    expect(sanitizeCategoryFilters(filters, allowed)).toEqual({ brand: 'acme' });
  });

  it('keeps a string value inside the allowed set', () => {
    expect(sanitizeCategoryFilters({ categoryIds: 'cat-a' }, allowed)).toEqual({ categoryIds: 'cat-a' });
  });

  it('keeps only the allowed ids when an array is partially outside', () => {
    const filters: SearchFilters = { categoryIds: ['cat-a', 'cat-x', 'cat-b'], color: ['red'] };

    expect(sanitizeCategoryFilters(filters, allowed)).toEqual({
      categoryIds: ['cat-a', 'cat-b'],
      color: ['red'],
    });
  });

  it('accepts the allowed ids as a string array', () => {
    expect(sanitizeCategoryFilters({ categoryIds: ['cat-a', 'cat-x'] }, ['cat-a'])).toEqual({
      categoryIds: ['cat-a'],
    });
  });

  it('returns unrelated filters unchanged (same values)', () => {
    const filters: SearchFilters = { brand: 'acme', price: { from: '1', till: '2' }, color: ['red'] };

    const result = sanitizeCategoryFilters(filters, allowed);

    expect(result).toBe(filters);
    expect(result).toEqual({ brand: 'acme', price: { from: '1', till: '2' }, color: ['red'] });
  });

  it('returns undefined for undefined input', () => {
    expect(sanitizeCategoryFilters(undefined, allowed)).toBeUndefined();
  });

  it('returns undefined when only a disallowed categoryIds filter is present', () => {
    expect(sanitizeCategoryFilters({ categoryIds: 'bad' }, allowed)).toBeUndefined();
  });

  it('returns undefined when an array categoryIds filter has no allowed ids', () => {
    expect(sanitizeCategoryFilters({ categoryIds: ['bad', 'worse'] }, allowed)).toBeUndefined();
  });

  it('returns undefined for an empty filters object', () => {
    expect(sanitizeCategoryFilters({}, allowed)).toBeUndefined();
  });

  it('removes a record-shaped categoryIds value', () => {
    expect(sanitizeCategoryFilters({ categoryIds: { from: '1', till: '2' }, brand: 'acme' }, allowed)).toEqual({
      brand: 'acme',
    });
  });

  it('does not mutate the input filters', () => {
    const filters: SearchFilters = { categoryIds: ['cat-a', 'cat-x'], brand: 'acme' };

    sanitizeCategoryFilters(filters, allowed);

    expect(filters).toEqual({ categoryIds: ['cat-a', 'cat-x'], brand: 'acme' });
  });
});

describe('hasCategoryIdsFilter', () => {
  it('is true only when the categoryIds key is present', () => {
    expect(hasCategoryIdsFilter(undefined)).toBe(false);
    expect(hasCategoryIdsFilter({ brand: 'acme' })).toBe(false);
    expect(hasCategoryIdsFilter({ categoryIds: 'cat-a' })).toBe(true);
    expect(hasCategoryIdsFilter({ categoryIds: ['cat-a'] })).toBe(true);
  });
});
