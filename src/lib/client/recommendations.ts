import type { ProductRecommendations } from '@/platform/services/model/product';

const _recommendationsInflight = new Map<string, Promise<ProductRecommendations>>();

export async function fetchRecommendations(productId: string): Promise<ProductRecommendations> {
  const existing = _recommendationsInflight.get(productId);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    const res = await fetch(`/api/search/recommendations/${productId}`);
    if (!res.ok) throw new Error('Failed to fetch recommendations');
    return (await res.json()) as ProductRecommendations;
  })();

  _recommendationsInflight.set(productId, promise);
  void promise.finally(() => {
    if (_recommendationsInflight.get(productId) === promise) {
      _recommendationsInflight.delete(productId);
    }
  });

  return promise;
}
