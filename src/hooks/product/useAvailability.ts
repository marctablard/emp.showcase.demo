import { useEffect, useState } from 'react';
import { fetchProductAvailability } from '@/lib/client/availability';
import { StockAvailability } from '@/platform/services/model/common';
import { useAvailabilityStore } from '@/stores/availability-store';

interface UseAvailabilityOptions {
  /**
   * Whether to automatically fetch availability on mount
   * @default true
   */
  autoFetch?: boolean;
}

interface UseAvailabilityResult {
  /**
   * Availability data for the product
   */
  availability: StockAvailability | null;

  /**
   * Whether the availability data is currently loading
   */
  isLoading: boolean;

  /**
   * Error that occurred during availability fetch, if any
   */
  error: Error | null;

  /**
   * Manually fetch availability data
   */
  fetchAvailability: () => Promise<void>;

  /**
   * Check if a specific quantity is available
   */
  hasSufficientStock: (quantity: number) => boolean;
}

/**
 * Hook for fetching and caching product availability
 * Uses the availability store for caching to prevent duplicate requests
 */
export function useAvailability(
  productId: string | null | undefined,
  options: UseAvailabilityOptions = {},
): UseAvailabilityResult {
  const { autoFetch = true } = options;

  // Get store actions
  const { getAvailability, setAvailability, setLoading, setError } = useAvailabilityStore();

  // Get cached availability from store
  const cachedAvailability = productId ? getAvailability(productId) : null;

  // Local state for loading and error
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setLocalError] = useState<Error | null>(null);

  // Function to fetch availability
  const fetchAvailability = async (): Promise<void> => {
    if (!productId) return;

    try {
      // Update loading state
      setIsLoading(true);
      setLoading(productId, true);

      // Fetch availability
      const availability = await fetchProductAvailability(productId);

      // Update store and local state
      setAvailability(availability);
      setIsLoading(false);
      setLocalError(null);
    } catch (err) {
      // Handle error
      const error = err instanceof Error ? err : new Error('Failed to fetch availability');
      setError(productId, error);
      setIsLoading(false);
      setLocalError(error);
    }
  };

  // Fetch availability on mount if autoFetch is true
  useEffect(() => {
    if (productId && autoFetch && !cachedAvailability) {
      fetchAvailability();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, autoFetch]);

  // Function to check if a specific quantity is available
  const hasSufficientStock = (quantity: number): boolean => {
    if (!cachedAvailability) return false;

    return cachedAvailability.isAvailable && cachedAvailability.availableQuantity >= quantity;
  };

  return {
    availability: cachedAvailability,
    isLoading,
    error,
    fetchAvailability,
    hasSufficientStock,
  };
}
