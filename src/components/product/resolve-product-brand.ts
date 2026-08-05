import type { LocalizedString } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';

type L10nFn = (value: string | LocalizedString | undefined | null) => string;

/**
 * Resolve a displayable brand label from a catalog product.
 * Prefers brand.name, then manufacturer specification — same source Quote/Approval use.
 */
export function resolveProductBrandLabel(
  product: Pick<Product, 'brand' | 'specifications'> | null | undefined,
  l10n: L10nFn,
): string | undefined {
  if (!product) {
    return undefined;
  }
  const fromBrand = l10n(product.brand?.name || '');
  if (fromBrand) {
    return fromBrand;
  }
  const manufacturer = product.specifications?.find((spec) => spec.key === 'manufacturer')?.value;
  const fromManufacturer = l10n(manufacturer || '');
  return fromManufacturer || undefined;
}

/**
 * Prefer an existing snapshot brand (order/return), otherwise catalog-resolved brand.
 */
export function coalesceBrandLabel(
  snapshotBrand: string | undefined | null,
  catalogBrand: string | undefined | null,
): string | undefined {
  const snapshot = snapshotBrand?.trim();
  if (snapshot) {
    return snapshot;
  }
  const catalog = catalogBrand?.trim();
  return catalog || undefined;
}
