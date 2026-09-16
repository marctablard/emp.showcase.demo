import { appendSiteQuery, requestSiteFromClientDedupeScope } from '@/lib/client/client-fetch-scope';
import type { ProductRecommendations } from '@/platform/services/model/product';

const _recommendationsInflight = new Map<string, Promise<ProductRecommendations>>();

export async function fetchRecommendations(productId: string, clientDedupeScope = ''): Promise<ProductRecommendations> {
  const cacheKey = `${productId}:${clientDedupeScope}`;
  const existing = _recommendationsInflight.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    const res = await fetch(
      appendSiteQuery(`/api/search/recommendations/${productId}`, requestSiteFromClientDedupeScope(clientDedupeScope)),
    );
    if (!res.ok) throw new Error('Failed to fetch recommendations');
    return (await res.json()) as ProductRecommendations;
  })();

  _recommendationsInflight.set(cacheKey, promise);
  void promise.finally(() => {
    if (_recommendationsInflight.get(cacheKey) === promise) {
      _recommendationsInflight.delete(cacheKey);
    }
  });

  return promise;
}
