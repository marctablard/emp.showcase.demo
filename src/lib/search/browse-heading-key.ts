import type { ProductsMode } from '@/platform/services/products-mode/ProductsModeService';

export type BrowseHeadingKey = 'searchResults' | 'assignedProducts' | 'allProducts';

/**
 * Translation key (namespace `search.searchResults`) of the PLP page heading (COP-4822).
 *
 * - a search phrase always wins: "Search Results" in every products mode, matching the list layout
 * - otherwise `assigned` mode reads "Assigned Products" and every other mode "All Products"
 */
export function browseHeadingKey(mode: ProductsMode, q?: string): BrowseHeadingKey {
  if (q?.trim()) {
    return 'searchResults';
  }
  return mode === 'assigned' ? 'assignedProducts' : 'allProducts';
}
