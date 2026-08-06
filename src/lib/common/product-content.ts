import type { Product } from '@/platform/services/model/product';

/**
 * Whether the PDP Key-specifications card has anything to show:
 * flagged specifications (`highlight === true`), or a non-empty legacy
 * variant/template attribute fallback.
 *
 * Empty arrays/objects are truthy in JS — do not use bare truthiness guards.
 */
export function hasKeySpecifications(product: Product): boolean {
  const flagged = product.specifications?.some((spec) => spec.highlight === true) ?? false;
  if (flagged) {
    return true;
  }

  if ((product.variantAttributes?.length ?? 0) > 0) {
    return true;
  }

  return Object.keys(product.templateAttributes ?? {}).length > 0;
}

/**
 * Whether the active locale has at least one Product Highlights bullet.
 * `{ en: [] }` and a missing locale key are both empty for that locale.
 */
export function hasLocalizedHighlights(product: Product, locale: string): boolean {
  return (product.highlights?.[locale]?.length ?? 0) > 0;
}

/**
 * Whether Technical Information has at least one specification group.
 * `groupedSpecifications: []` must not render the section or its jump link.
 */
export function hasTechnicalInformation(product: Product): boolean {
  return (product.groupedSpecifications?.length ?? 0) > 0;
}
