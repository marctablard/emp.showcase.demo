import { clearMarkHighlights } from '@/lib/common/clear-mark-highlights';
import type { Product } from '@/platform/services/model/product';
import type { SearchSuggestions } from '@/platform/services/model/search';

export const MAX_PREVIEW_TERMS = 3;
export const MAX_PREVIEW_PRODUCTS = 6;
export const MAX_PREVIEW_QUERIES = 8;

export type SearchPreviewSource = 'history' | 'popular';

export interface SearchPreview {
  /** `history`: ranked for the shopper's past searches; `popular`: the engine's empty-query ranking. */
  source: SearchPreviewSource;
  products: Product[];
  queryCompletions: string[];
}

export const EMPTY_SEARCH_PREVIEW: SearchPreview = { source: 'popular', products: [], queryCompletions: [] };

const normalize = (value: string) => value.trim().toLowerCase();

/** Preview tiles render without a keyword, so engine `<mark>` highlights must not reach them. */
export function stripProductHighlights(product: Product): Product {
  return JSON.parse(JSON.stringify(product).replace(/<\/?mark>/g, '')) as Product;
}

/** Newest-first, de-duplicated (case-insensitive), non-empty terms, capped at `MAX_PREVIEW_TERMS`. */
export function previewTerms(history: readonly string[]): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (let i = history.length - 1; i >= 0 && terms.length < MAX_PREVIEW_TERMS; i--) {
    const term = history[i]?.trim();
    if (!term || seen.has(normalize(term))) continue;
    seen.add(normalize(term));
    terms.push(term);
  }
  return terms;
}

/**
 * Interleaves the products of each per-term result (round-robin, so the newest search leads but
 * every term is represented) and collects query completions that are not already one of the terms.
 */
export function mergePreviewSuggestions(
  terms: readonly string[],
  results: readonly SearchSuggestions[],
): SearchPreview {
  const products: Product[] = [];
  const productIds = new Set<string>();
  const longest = Math.max(0, ...results.map((r) => r.products?.length ?? 0));
  for (let i = 0; i < longest && products.length < MAX_PREVIEW_PRODUCTS; i++) {
    for (const result of results) {
      const product = result.products?.[i];
      if (!product || productIds.has(product.id)) continue;
      productIds.add(product.id);
      products.push(stripProductHighlights(product));
      if (products.length >= MAX_PREVIEW_PRODUCTS) break;
    }
  }

  const excluded = new Set(terms.map(normalize));
  const queryCompletions: string[] = [];
  for (const result of results) {
    for (const completion of result.queryCompletions ?? []) {
      const plain = clearMarkHighlights(completion).trim();
      if (!plain || excluded.has(normalize(plain))) continue;
      excluded.add(normalize(plain));
      queryCompletions.push(plain);
      if (queryCompletions.length >= MAX_PREVIEW_QUERIES) break;
    }
  }

  return { source: 'history', products, queryCompletions };
}
