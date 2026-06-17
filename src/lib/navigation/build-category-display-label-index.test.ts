import type { Category } from '@/platform/services/model/category';
import { buildCategoryDisplayLabelIndex } from './build-category-display-label-index';

function cat(id: string, name: Record<string, string>, children?: Category[]): Category {
  return {
    id,
    name,
    ...(children?.length ? { children } : {}),
  };
}

describe('buildCategoryDisplayLabelIndex', () => {
  it('indexes single root', () => {
    const roots = [cat('a', { en: 'Alpha', de: 'Alpha DE' })];
    expect(buildCategoryDisplayLabelIndex(roots, 'en')).toEqual({ a: 'Alpha' });
    expect(buildCategoryDisplayLabelIndex(roots, 'de')).toEqual({ a: 'Alpha DE' });
  });

  it('walks nested children', () => {
    const roots = [cat('root', { en: 'Root' }, [cat('child', { en: 'Child' }, [cat('leaf', { en: 'Leaf' })])])];
    expect(buildCategoryDisplayLabelIndex(roots, 'en')).toEqual({
      root: 'Root',
      child: 'Child',
      leaf: 'Leaf',
    });
  });

  it('first non-empty label wins for duplicate id', () => {
    const roots = [cat('dup', { en: 'First' }), cat('dup', { en: 'Second' })];
    expect(buildCategoryDisplayLabelIndex(roots, 'en')).toEqual({ dup: 'First' });
  });

  it('skips empty labels but later visit can still fill if first was empty', () => {
    const roots = [cat('x', { en: '' }), cat('x', { en: 'Filled' })];
    expect(buildCategoryDisplayLabelIndex(roots, 'en')).toEqual({ x: 'Filled' });
  });

  it('handles empty children array', () => {
    const roots = [cat('only', { en: 'Only' }, [])];
    expect(buildCategoryDisplayLabelIndex(roots, 'en')).toEqual({ only: 'Only' });
  });

  it('omits categories with no session or default locale label', () => {
    const roots = [cat('ja-only', { ja: '日本語' })];
    expect(buildCategoryDisplayLabelIndex(roots, 'en')).toEqual({});
  });
});
