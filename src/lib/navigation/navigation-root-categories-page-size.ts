const DEFAULT_ROOT_CATEGORIES_PAGE_SIZE = 6;

/**
 * How many category links to show before a "Show all" control (shared everywhere).
 *
 * Used for:
 * - SSR root list passed to the header/footer (`takeRootCategoryPage`)
 * - Footer "Products" column (sliced client-side to match)
 * - Desktop flyout columns 2–3 (children lists sliced with `takeRootCategoryPage`)
 * - Tablet/mobile product submenu lists where applicable
 * - `showSeeAllBrowse` when total roots exceed this value
 *
 * Set `NEXT_PUBLIC_NAVIGATION_ROOT_CATEGORIES_PAGE_SIZE` (positive integer). Default: 6.
 */
export function getNavigationRootCategoriesPageSize(): number {
  const raw = process.env.NEXT_PUBLIC_NAVIGATION_ROOT_CATEGORIES_PAGE_SIZE;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_ROOT_CATEGORIES_PAGE_SIZE;
}

/** Alias for {@link getNavigationRootCategoriesPageSize} (same env var). */
export function getNavigationCategoryPreviewCount(): number {
  return getNavigationRootCategoriesPageSize();
}
