import { useEffect, useState } from 'react';
import { fetchRecommendations } from '@/lib/client/recommendations';
import type { ProductRecommendations } from '@/platform/services/model/product';

export function useRecommendations(productId?: string) {
  const [recommendations, setRecommendations] = useState<ProductRecommendations | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) {
      return;
    }

    let isCancelled = false;

    const fetchData = async () => {
      if (isCancelled) {
        return;
      }

      setRecommendations(undefined);
      setLoading(true);
      setError(null);

      fetchRecommendations(productId)
        .then((result) => {
          if (!isCancelled) setRecommendations(result);
        })
        .catch((err) => {
          if (!isCancelled) setError((err as Error).message);
        })
        .finally(() => {
          if (!isCancelled) setLoading(false);
        });
    };

    void fetchData();

    return () => {
      isCancelled = true;
    };
  }, [productId]);

  const hasProduct = Boolean(productId);

  return {
    recommendations: hasProduct ? recommendations : undefined,
    loading: hasProduct ? loading : false,
    error: hasProduct ? error : null,
  };
}
