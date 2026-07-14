import type { ProductRecommendations } from '@/platform/services/model/product';

export async function fetchRecommendations(productId: string, locale?: string): Promise<ProductRecommendations> {
  const params = new URLSearchParams();
  if (locale) {
    params.set('locale', locale);
  }

  const query = params.toString();
  const res = await fetch(`/api/search/recommendations/${encodeURIComponent(productId)}${query ? `?${query}` : ''}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch recommendations');
  return res.json();
}
