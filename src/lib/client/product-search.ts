import type { Paginated } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';

export async function searchProductsByName(
  query: string,
  options?: { locale?: string; page?: number; pageSize?: number },
): Promise<Paginated<Product>> {
  const url = new URL('/api/products/search', window.location.origin);
  url.searchParams.set('query', query);

  if (options?.locale) {
    url.searchParams.set('locale', options.locale);
  }
  if (options?.page !== undefined) {
    url.searchParams.set('page', String(options.page));
  }
  if (options?.pageSize !== undefined) {
    url.searchParams.set('size', String(options.pageSize));
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as { error?: string }).error || response.statusText);
  }

  return response.json();
}
