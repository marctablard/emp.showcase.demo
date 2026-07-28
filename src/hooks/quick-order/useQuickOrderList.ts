'use client';

import { useCallback, useRef, useState } from 'react';
import { fetchProductPrices } from '@/lib/client/prices';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Product } from '@/platform/services/model/product';
import { useSessionStore } from '@/providers/StoreProvider';

export interface QuickOrderItem {
  product: Product;
  quantity: number;
}

export interface UseQuickOrderList {
  items: QuickOrderItem[];
  addProducts: (entries: Array<{ product: Product; quantity: number }>) => void;
  removeProduct: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearAll: () => void;
  netSubtotal: number;
  grossSubtotal: number;
  vatTotal: number;
  currency: string;
  itemCount: number;
  pricesLoading: boolean;
}

export function useQuickOrderList(): UseQuickOrderList {
  const [items, setItems] = useState<QuickOrderItem[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const { session } = useSessionStore();
  const enrichedIdsRef = useRef<Set<string>>(new Set());
  const inflightRef = useRef(0);

  const enrichProductPrices = useCallback(async (productIds: string[], currency?: string) => {
    inflightRef.current += 1;
    setPricesLoading(true);
    try {
      const priceMap = await fetchProductPrices(productIds, currency);
      const enrichedIds = productIds.filter((id) => priceMap[id] != null);
      setItems((prev) =>
        prev.map((item) => {
          const fetchedPrice = priceMap[item.product.id];
          if (!fetchedPrice) return item;
          return {
            ...item,
            product: { ...item.product, price: fetchedPrice },
          };
        }),
      );
      for (const id of enrichedIds) {
        enrichedIdsRef.current.add(id);
      }
    } catch (error) {
      getLogger().error({ error, productIds }, 'Failed to enrich quick order prices');
    } finally {
      inflightRef.current -= 1;
      if (inflightRef.current === 0) {
        setPricesLoading(false);
      }
    }
  }, []);

  const addProducts = useCallback(
    (entries: Array<{ product: Product; quantity: number }>) => {
      setItems((prev) => {
        const next = [...prev];
        for (const entry of entries) {
          const existingIndex = next.findIndex((item) => item.product.id === entry.product.id);
          if (existingIndex >= 0) {
            next[existingIndex] = {
              ...next[existingIndex],
              quantity: next[existingIndex].quantity + entry.quantity,
            };
          } else {
            next.push({
              product: entry.product,
              quantity: Math.max(1, entry.quantity),
            });
          }
        }
        return next;
      });

      const idsNeedingPrices = [
        ...new Set(
          entries
            .filter((e) => e.product.price?.tax?.netValue == null && !enrichedIdsRef.current.has(e.product.id))
            .map((e) => e.product.id),
        ),
      ];

      if (idsNeedingPrices.length > 0) {
        void enrichProductPrices(idsNeedingPrices, session?.currency);
      }
    },
    [enrichProductPrices, session?.currency],
  );

  const removeProduct = useCallback((productId: string) => {
    enrichedIdsRef.current.delete(productId);
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    const clampedQuantity = Math.max(1, quantity);
    setItems((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity: clampedQuantity } : item)),
    );
  }, []);

  const clearAll = useCallback(() => {
    enrichedIdsRef.current.clear();
    setItems([]);
  }, []);

  const netSubtotal = items.reduce(
    (sum, item) => sum + (item.product.price?.tax?.netValue ?? item.product.price?.amount ?? 0) * item.quantity,
    0,
  );

  const grossSubtotal = items.reduce(
    (sum, item) => sum + (item.product.price?.tax?.grossValue ?? item.product.price?.amount ?? 0) * item.quantity,
    0,
  );

  const vatTotal = grossSubtotal - netSubtotal;

  const sessionCurrency = session?.currency;
  const firstItemCurrency = items[0]?.product.price?.currency;
  // TODO: Fall back to a proper default from site config when session is not yet available
  const currency = sessionCurrency ?? firstItemCurrency ?? 'EUR';

  const itemCount = items.length;

  return {
    items,
    addProducts,
    removeProduct,
    updateQuantity,
    clearAll,
    netSubtotal,
    grossSubtotal,
    vatTotal,
    currency,
    itemCount,
    pricesLoading,
  };
}
