import { useCallback, useEffect, useState } from 'react';
import { useShopContextReady } from '@/hooks/common/useShopContextReady';
import { useSession } from '@/hooks/session/useSession';
import { fetchRecommendations } from '@/lib/client/recommendations';
import { buildSessionPricingScopeKey } from '@/lib/common/price-fetch-options';
import type { ProductRecommendations } from '@/platform/services/model/product';

export function useRecommendations(productId?: string, locale?: string) {
  const { session } = useSession();
  const { ready: shopContextReady } = useShopContextReady();
  const sessionPricingScope = buildSessionPricingScopeKey(session);
  const [recommendations, setRecommendations] = useState<ProductRecommendations | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecommendations = useCallback(async (id: string, currentLocale?: string, isCancelled?: () => boolean) => {
    setRecommendations(undefined);
    setLoading(true);
    setError(null);

    try {
      const result = await fetchRecommendations(id, currentLocale);
      if (isCancelled?.()) return;
      setRecommendations(result);
    } catch (err) {
      if (isCancelled?.()) return;
      setError((err as Error).message);
    } finally {
      if (isCancelled?.()) return;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!productId || !shopContextReady) {
      return;
    }

    let cancelled = false;

    void loadRecommendations(productId, locale, () => cancelled);

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, locale, shopContextReady, sessionPricingScope, loadRecommendations]);

  const hasProduct = Boolean(productId);
  const waitingForShopContext = hasProduct && !shopContextReady;
  const pending = hasProduct && !loading && !error && recommendations === undefined;

  return {
    recommendations: hasProduct && shopContextReady ? recommendations : undefined,
    loading: hasProduct && (waitingForShopContext || loading || pending),
    error: hasProduct ? error : null,
  };
}
