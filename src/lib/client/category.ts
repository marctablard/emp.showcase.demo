import { getLogger } from '@/lib/logger/use-logger-client';
import type { Category } from '@/platform/services/model/category';

/**
 * Fetch the category tree from the API
 * @param categoryId The ID of the root category (defaults to 'root')
 * @param showUnpublished Whether to include unpublished categories
 * @returns The category tree
 */
export async function fetchCategoryTree(
  categoryId: string = 'root',
  showUnpublished: boolean = false,
): Promise<Category | null> {
  try {
    const url = new URL('/api/categories/tree', window.location.origin);
    url.searchParams.append('categoryId', categoryId);
    if (showUnpublished) {
      url.searchParams.append('showUnpublished', 'true');
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      // Handle 404 gracefully - category not found is an expected case
      if (response.status === 404) {
        getLogger().debug({ categoryId }, `Category '${categoryId}' not found`);
        return null;
      }

      // Handle other errors
      const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
      getLogger().error(
        {
          status: response.status,
          statusText: response.statusText,
          errorData,
          categoryId,
        },
        'Error response from API',
      );
      throw new Error(errorData.error || `API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    getLogger().error({ err: error, categoryId }, 'Error fetching category tree');
    throw error;
  }
}

/**
 * Fetch the total number of products assigned to a category (including subcategories).
 *
 * Returns `0` on any error — the count is a best-effort display value.
 */
export async function fetchCategoryProductCount(categoryId: string): Promise<number> {
  const trimmedId = categoryId?.trim();
  if (!trimmedId) {
    return 0;
  }

  try {
    const url = new URL(`/api/categories/${encodeURIComponent(trimmedId)}/product-count`, window.location.origin);
    const response = await fetch(url.toString());

    if (!response.ok) {
      getLogger().debug(
        { status: response.status, statusText: response.statusText, categoryId: trimmedId },
        'Non-OK response fetching category product count',
      );
      return 0;
    }

    const data = (await response.json()) as { count?: unknown };
    if (typeof data.count !== 'number' || data.count < 0 || !Number.isFinite(data.count)) {
      return 0;
    }
    return data.count;
  } catch (error) {
    getLogger().debug({ err: error, categoryId: trimmedId }, 'Error fetching category product count');
    return 0;
  }
}
