import { l10n as l10nFn } from '@/lib/utils';
import type { Product } from '@/platform/services/model/product';
import type { ProductSearchResult } from '../types';

/**
 * Map an internal {@link Product} into the {@link ProductSearchResult}
 * shape consumed by the CMS editor's product picker.
 *
 * The field stores `sku` as its value, so prefer `product.sku` and fall
 * back to `product.id` when Emporix didn't populate sku — the editor
 * needs *some* stable identifier in every row.
 */
export function mapProductToSearchResult(product: Product, locale: string): ProductSearchResult {
  const sku = product.sku || product.id;
  const name = l10nFn(product.name, locale) || sku;

  const result: ProductSearchResult = { sku, name };

  const imageUrl = product.primaryImage?.url ?? product.images?.[0]?.url;
  if (imageUrl) {
    result.imageUrl = imageUrl;
  }

  if (product.price && typeof product.price.amount === 'number' && product.price.currency) {
    result.price = { amount: product.price.amount, currency: product.price.currency };
  }

  if (product.categories && product.categories.length > 0) {
    const categoryNames = product.categories
      .map((c) => l10nFn(c.name, locale) || c.code || '')
      .filter((n) => n.length > 0);
    if (categoryNames.length > 0) {
      result.categoryNames = categoryNames;
    }
  }

  return result;
}
