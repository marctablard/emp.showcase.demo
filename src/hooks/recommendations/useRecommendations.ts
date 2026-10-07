import { useEffect, useState } from 'react';
import { useClientFetchScope } from '@/hooks/common/useClientFetchScope';
import { useShopContextReady } from '@/hooks/common/useShopContextReady';
import { useSession } from '@/hooks/session/useSession';
import { fetchRecommendations } from '@/lib/client/recommendations';
import { buildSessionPricingScopeKey } from '@/lib/common/price-fetch-options';
import type { ProductRecommendations } from '@/platform/services/model/product';

export function useRecommendations(productId?: string, locale?: string) {
  const { session } = useSession();
  const clientDedupeScope = useClientFetchScope(session?.currency);
  const { ready: shopContextReady } = useShopContextReady();
  const sessionPricingScope = buildSessionPricingScopeKey(session);
  const [recommendations, setRecommendations] = useState<ProductRecommendations | undefined>(undefined);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId || !shopContextReady) {
      return;
    }

    let isCancelled = false;

    const fetchData = async () => {
      if (isCancelled) {
        return;
      }

      setRecommendations(undefined);
      setFetchLoading(true);
      setError(null);

      fetchRecommendations(productId, `${clientDedupeScope}:${sessionPricingScope}`, locale)
        .then((result) => {
          if (!isCancelled) setRecommendations(result);
        })
        .catch((err) => {
          if (!isCancelled) setError((err as Error).message);
        })
        .finally(() => {
          if (!isCancelled) setFetchLoading(false);
        });
    };

    void fetchData();

    return () => {
      isCancelled = true;
      setFetchLoading(false);
    };
  }, [
    productId,
    locale,
    shopContextReady,
    session?.currency,
    session?.siteCode,
    clientDedupeScope,
    sessionPricingScope,
  ]);

  const hasProduct = Boolean(productId);
  const waitingForShopContext = hasProduct && !shopContextReady;
  const pending = hasProduct && !fetchLoading && !error && recommendations === undefined;

  return {
    recommendations: hasProduct && shopContextReady ? recommendations : undefined,
    loading: hasProduct && (waitingForShopContext || fetchLoading || pending),
    error: hasProduct ? error : null,
  };
}
