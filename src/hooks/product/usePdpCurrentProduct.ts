'use client';

import { useEffect } from 'react';
import type { Product } from '@/platform/services/model/product';

/**
 * Marks the viewed PDP product as current in the product store for the page lifetime.
 */
export function usePdpCurrentProduct(
  product: Product | null | undefined,
  setAsCurrent: (current?: boolean) => void,
): void {
  useEffect(() => {
    if (product) {
      setAsCurrent();
    }
    return () => {
      setAsCurrent(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);
}
