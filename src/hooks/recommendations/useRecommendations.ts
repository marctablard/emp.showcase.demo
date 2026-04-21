import { useEffect, useState } from 'react';
import { useShopContextReady } from '@/hooks/common/useShopContextReady';
import { useSession } from '@/hooks/session/useSession';
import { fetchRecommendations } from '@/lib/client/recommendations';
import type { ProductRecommendations } from '@/platform/services/model/product';

export function useRecommendations(productId?: string) {
  const { session } = useSession();
  const { ready: shopContextReady } = useShopContextReady();
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

      fetchRecommendations(productId)
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
  }, [productId, shopContextReady, session?.currency, session?.siteCode]);

  const hasProduct = Boolean(productId);
  const waitingForShopContext = hasProduct && !shopContextReady;
  const loading = hasProduct && (waitingForShopContext || fetchLoading);

  return {
    recommendations: hasProduct && shopContextReady ? recommendations : undefined,
    loading: hasProduct ? loading : false,
    error: hasProduct ? error : null,
  };
}
