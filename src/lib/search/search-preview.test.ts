import type { Product } from '@/platform/services/model/product';
import type { SearchSuggestions } from '@/platform/services/model/search';
import {
  MAX_PREVIEW_PRODUCTS,
  MAX_PREVIEW_TERMS,
  mergePreviewSuggestions,
  previewTerms,
  stripProductHighlights,
} from './search-preview';

const product = (id: string, name = `Product ${id}`): Product => ({ id, name }) as unknown as Product;
const result = (ids: string[], queryCompletions: string[] = []): SearchSuggestions =>
  ({ products: ids.map((id) => product(id)), queryCompletions, categories: [] }) as unknown as SearchSuggestions;

describe('previewTerms', () => {
  it('returns the newest distinct non-empty terms first, capped', () => {
    expect(previewTerms(['a', 'B', ' ', 'c', 'b', 'd', 'e'])).toEqual(['e', 'd', 'b']);
    expect(previewTerms(['a', 'b', 'c', 'd', 'e'])).toHaveLength(MAX_PREVIEW_TERMS);
  });

  it('is empty without history', () => {
    expect(previewTerms([])).toEqual([]);
  });
});

describe('mergePreviewSuggestions', () => {
  it('interleaves products per term, de-duplicates and caps them', () => {
    const merged = mergePreviewSuggestions(
      ['newest', 'older'],
      [result(['n1', 'shared', 'n2', 'n3']), result(['o1', 'shared', 'o2', 'o3'])],
    );

    expect(merged.source).toBe('history');
    expect(merged.products.map((p) => p.id)).toEqual(['n1', 'o1', 'shared', 'n2', 'o2', 'n3']);
    expect(merged.products).toHaveLength(MAX_PREVIEW_PRODUCTS);
  });

  it('keeps completions that are not already a past search, without highlights', () => {
    const merged = mergePreviewSuggestions(
      ['inverter'],
      [result([], ['<mark>inverter</mark>', '<mark>inverter</mark>s', 'Inverters'])],
    );

    expect(merged.queryCompletions).toEqual(['inverters']);
  });

  it('strips engine highlights from products', () => {
    const merged = mergePreviewSuggestions(
      ['fluid'],
      [{ products: [product('p', 'Dielectric <mark>Fluid</mark>')], queryCompletions: [], categories: [] }],
    );

    expect(merged.products[0]?.name).toBe('Dielectric Fluid');
    expect(stripProductHighlights(product('x', '<mark>A</mark>B')).name).toBe('AB');
  });
});
