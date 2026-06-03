'use client';

import { useCallback, useState } from 'react';
import { useLocale } from 'next-intl';
import { fetchProductPrices } from '@/lib/client/prices';
import { searchProductsByName } from '@/lib/client/product-search';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { Product } from '@/platform/services/model/product';
import { useSessionStore } from '@/providers/StoreProvider';

export function useProductNameSearch() {
  const locale = useLocale();
  const sessionCurrency = useSessionStore().session?.currency;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enrichProductPrices = useCallback(
    async (items: Product[]) => {
      const productIds = items.map((product) => product.id).filter(Boolean);
      if (productIds.length === 0) {
        return items;
      }

      setPricesLoading(true);
      try {
        const priceMap = await fetchProductPrices(productIds, sessionCurrency);
        return items.map((product) => {
          const price = priceMap[product.id];
          return price ? { ...product, price } : product;
        });
      } catch (err) {
        getLogger().error({ err, productIds }, 'Failed to fetch prices for product search results');
        return items;
      } finally {
        setPricesLoading(false);
      }
    },
    [sessionCurrency],
  );

  const search = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) {
        setProducts([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await searchProductsByName(trimmed, { locale, page: 0, pageSize: 12 });
        const productsWithPrices = await enrichProductPrices(result.items);
        setProducts(productsWithPrices);
      } catch (err) {
        getLogger().error({ err, query: trimmed }, 'Product name search failed');
        setProducts([]);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [enrichProductPrices, locale],
  );

  const reset = useCallback(() => {
    setProducts([]);
    setError(null);
    setPricesLoading(false);
  }, []);

  return { products, loading, pricesLoading, error, search, reset };
}
