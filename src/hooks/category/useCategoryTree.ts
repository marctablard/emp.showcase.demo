'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchCategoryTree } from '@/lib/client/category';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Category } from '@/platform/services/model/category';

interface CategoryTreeHook {
  categoryTree: Category | null;
  loading: boolean;
  error: Error | null;
  notFound: boolean;
  fetchTree: (categoryId?: string, showUnpublished?: boolean) => Promise<void>;
}

/**
 * Hook for fetching and managing category tree data
 * @param initialCategoryTree Optional initial category tree data
 * @param initialCategoryId Optional category ID to fetch (defaults to 'root')
 * @param showUnpublished Whether to include unpublished categories
 * @returns Category tree data and state
 */
export const useCategoryTree = (
  initialCategoryTree?: Category | null,
  initialCategoryId: string = 'root',
  showUnpublished: boolean = false,
): CategoryTreeHook => {
  const [categoryTree, setCategoryTree] = useState<Category | null>(initialCategoryTree || null);
  const [loading, setLoading] = useState<boolean>(!initialCategoryTree);
  const [error, setError] = useState<Error | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);

  const fetchTree = useCallback(
    async (categoryId: string = initialCategoryId, showUnpub: boolean = showUnpublished) => {
      try {
        setLoading(true);
        setError(null);
        setNotFound(false);

        const data = await fetchCategoryTree(categoryId, showUnpub);

        if (data === null) {
          // Category not found case
          setNotFound(true);
          setCategoryTree(null);
        } else {
          setCategoryTree(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch category tree'));
        getLogger().error({ err }, 'Error fetching category tree');
      } finally {
        setLoading(false);
      }
    },
    [initialCategoryId, showUnpublished],
  );

  // Initialize category tree on first render if not already initialized
  useEffect(() => {
    if (!initialCategoryTree) {
      fetchTree();
    }
  }, [fetchTree, initialCategoryTree]);

  return {
    categoryTree,
    loading,
    error,
    notFound,
    fetchTree,
  };
};

export default useCategoryTree;
