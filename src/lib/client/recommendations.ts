import { appendSiteQuery, requestSiteFromClientDedupeScope } from '@/lib/client/client-fetch-scope';
import type { ProductRecommendations } from '@/platform/services/model/product';

const _recommendationsInflight = new Map<string, Promise<ProductRecommendations>>();

export async function fetchRecommendations(
  productId: string,
  clientDedupeScope = '',
  locale?: string,
): Promise<ProductRecommendations> {
  const cacheKey = `${productId}:${clientDedupeScope}:${locale ?? ''}`;
  const existing = _recommendationsInflight.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    const path = appendSiteQuery(
      `/api/search/recommendations/${encodeURIComponent(productId)}`,
      requestSiteFromClientDedupeScope(clientDedupeScope),
    );
    const url = locale ? `${path}${path.includes('?') ? '&' : '?'}locale=${encodeURIComponent(locale)}` : path;
    const res = await fetch(url, { cache: 'no-store' });
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
