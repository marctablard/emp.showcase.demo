import { isPlaceholderAttributeLabel } from '@/lib/common/product-template-attributes';
import type { Product, ProductVariantAttribute } from '@/platform/services/model/product';

/** Parent PLP tiles: label-only badges for each variant attribute axis. */
export const PARENT_VARIANT_LABEL_BADGE_LIMIT = 6;
/** Child / sellable variant tiles: value + label pairs. */
export const VARIANT_ATTRIBUTE_PAIR_BADGE_LIMIT = 3;

/** Parent, child, DYNAMIC_VARIANT tree, or any product that already carries variant-family data. */
export function isVariantFamilyProduct(product: Product): boolean {
  if (product.productType === 'DYNAMIC_VARIANT') {
    return true;
  }
  if (product.isParentVariant || Boolean(product.parentVariantId)) {
    return true;
  }
  if ((product.variantCount ?? 0) > 0) {
    return true;
  }
  if ((product.variants?.length ?? 0) > 0) {
    return true;
  }
  return Boolean(product.variantAttributes && product.variantAttributes.length > 0);
}

export interface ProductVariantAttributeGroup {
  key: string;
  name?: ProductVariantAttribute['name'];
  values: string[];
}

/**
 * Coerce Product Service variant value keys (string | number | boolean) to display/compare strings.
 * Returns undefined for nullish / empty string so callers can skip invalid entries.
 */
export function normalizeVariantAttributeValueKey(key: unknown): string | undefined {
  if (typeof key === 'string') {
    return key.length > 0 ? key : undefined;
  }
  if (typeof key === 'number' && Number.isFinite(key)) {
    return String(key);
  }
  if (typeof key === 'boolean') {
    return String(key);
  }
  return undefined;
}

function hasAttributeValue(value: string | undefined): boolean {
  return value !== undefined && value !== '';
}

/**
 * Stable storefront order: Product Templates `attributes[]` (`templateAttributeOrder`),
 * then any remaining keys in first-seen order.
 */
export function sortKeysByTemplateAttributeOrder(keys: readonly string[], order?: readonly string[]): string[] {
  if (keys.length === 0) {
    return [];
  }
  if (!order?.length) {
    return [...keys];
  }

  const keySet = new Set(keys);
  const seen = new Set<string>();
  const sorted: string[] = [];

  for (const key of order) {
    if (!keySet.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    sorted.push(key);
  }

  for (const key of keys) {
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    sorted.push(key);
  }

  return sorted;
}

function rememberAttributeName(
  nameByKey: Map<string, ProductVariantAttribute['name']>,
  attribute: Pick<ProductVariantAttribute, 'key' | 'name'>,
): void {
  if (attribute.name == null) {
    return;
  }
  const current = nameByKey.get(attribute.key);
  if (current != null && !isPlaceholderAttributeLabel(current, attribute.key)) {
    return;
  }
  nameByKey.set(attribute.key, attribute.name);
}

function collectAttributeKeysFromProduct(product: Product, keys: Set<string>): void {
  product.variantAttributes?.forEach((attribute) => {
    if (attribute.key) {
      keys.add(attribute.key);
    }
  });
  Object.keys(product.variantAttributeValues ?? {}).forEach((key) => {
    keys.add(key);
  });
}

/**
 * Variant-attribute axis keys for a family, ordered by `templateAttributeOrder`.
 * When sellable variants are present, only keys those variants actually use
 * (skips template-only attributes such as an unused BOOLEAN).
 */
export function collectVariantAttributeKeys(product: Product, variants: Product[] = []): string[] {
  const keys = new Set<string>();
  const family = [...(product.variants ?? []), ...variants];
  if (family.length > 0) {
    family.forEach((variant) => collectAttributeKeysFromProduct(variant, keys));
  } else {
    collectAttributeKeysFromProduct(product, keys);
  }
  return sortKeysByTemplateAttributeOrder([...keys], product.templateAttributeOrder);
}

export interface VariantAttributeDisplayPair {
  key: string;
  name?: ProductVariantAttribute['name'];
  value: string;
}

/**
 * Card call-outs: display pairs the shopper has not selected yet.
 * Used so sellable cards omit axes already chosen in the configurator.
 */
export function getUnselectedVariantAttributePairs(
  product: Product,
  selectedAttributes: Record<string, string> = {},
): VariantAttributeDisplayPair[] {
  return getVariantAttributeDisplayPairs(product).filter((pair) => !hasAttributeValue(selectedAttributes[pair.key]));
}

/** Selected value/label pairs for a sellable variant, ordered by `templateAttributeOrder`. */
export function getVariantAttributeDisplayPairs(product: Product): VariantAttributeDisplayPair[] {
  const selected = getSelectedVariantAttributeValues(product);
  const nameByKey = new Map<string, ProductVariantAttribute['name']>();
  product.variantAttributes?.forEach((attribute) => rememberAttributeName(nameByKey, attribute));

  return sortKeysByTemplateAttributeOrder(Object.keys(selected), product.templateAttributeOrder)
    .filter((key) => hasAttributeValue(selected[key]))
    .map((key) => ({
      key,
      name: nameByKey.get(key),
      value: selected[key],
    }));
}

/**
 * Collect unique variant attribute values across all sellable variants,
 * ordered by `templateAttributeOrder` when present.
 */
export function collectVariantAttributeGroups(product: Product, variants: Product[]): ProductVariantAttributeGroup[] {
  const valuesByKey = new Map<string, Set<string>>();
  const nameByKey = new Map<string, ProductVariantAttribute['name']>();

  const addValue = (attributeKey: string, rawKey: unknown): void => {
    const valueKey = normalizeVariantAttributeValueKey(rawKey);
    if (valueKey === undefined) {
      return;
    }
    if (!valuesByKey.has(attributeKey)) {
      valuesByKey.set(attributeKey, new Set());
    }
    valuesByKey.get(attributeKey)?.add(valueKey);
  };

  product.variantAttributes?.forEach((attribute) => rememberAttributeName(nameByKey, attribute));

  const addVariantSelection = (variant: Product): void => {
    variant.variantAttributes?.forEach((attribute) => rememberAttributeName(nameByKey, attribute));
    const mixinKeys = new Set<string>();
    Object.entries(variant.variantAttributeValues ?? {}).forEach(([key, value]) => {
      addValue(key, value);
      mixinKeys.add(key);
    });
    variant.variantAttributes?.forEach((attribute) => {
      if (mixinKeys.has(attribute.key)) {
        return;
      }
      attribute.values?.forEach((value) => {
        if (value.selected) {
          addValue(attribute.key, value.key);
        }
      });
    });
  };

  // Unique mixin values across sellable variants. Prefer mixins when present —
  // catalog `values[].selected` can mark a default NUMBER option (e.g. `0`)
  // instead of that variant's mixin. Sibling values such as NUMBER `0` stay
  // visible when they are real mixins on other variants.
  variants.forEach(addVariantSelection);

  const currentAlreadyIncluded = variants.some((variant) => variant.id === product.id);
  const currentIsSellableVariant = Boolean(product.parentVariantId) && !product.isParentVariant;
  if (!currentAlreadyIncluded && currentIsSellableVariant) {
    addVariantSelection(product);
  }

  // Fallback: if variants lack attribute payloads, use the parent's value catalog.
  if (valuesByKey.size === 0) {
    product.variantAttributes?.forEach((attribute) => {
      attribute.values?.forEach((value) => {
        addValue(attribute.key, value.key);
      });
    });
  }

  const discoveredKeys = [
    ...(product.variantAttributes ?? []).map((attribute) => attribute.key),
    ...valuesByKey.keys(),
  ];
  const orderedKeys = sortKeysByTemplateAttributeOrder(discoveredKeys, product.templateAttributeOrder);

  const seen = new Set<string>();
  const groups: ProductVariantAttributeGroup[] = [];

  orderedKeys.forEach((key) => {
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    const values = [...(valuesByKey.get(key) ?? [])];
    if (values.length === 0) {
      return;
    }
    groups.push({
      key,
      name: nameByKey.get(key),
      values,
    });
  });

  valuesByKey.forEach((values, key) => {
    if (seen.has(key) || values.size === 0) {
      return;
    }
    groups.push({
      key,
      name: nameByKey.get(key),
      values: [...values],
    });
  });

  return groups;
}

/**
 * Selected attribute value keys for a variant (key → value key).
 * Prefer mixins.`productVariantAttributes` (`variantAttributeValues`) when present —
 * catalog `values[].selected` on expanded parentVariant payloads can mark the
 * default/first NUMBER option (e.g. `0`) instead of this variant's mixin value.
 */
export function getSelectedVariantAttributeValues(variant: Product): Record<string, string> {
  const selected: Record<string, string> = {};
  Object.entries(variant.variantAttributeValues ?? {}).forEach(([key, value]) => {
    const valueKey = normalizeVariantAttributeValueKey(value);
    if (valueKey !== undefined) {
      selected[key] = valueKey;
    }
  });
  variant.variantAttributes?.forEach((attribute) => {
    if (selected[attribute.key] !== undefined) {
      return;
    }
    const selectedValue = attribute.values?.find((value) => value.selected);
    const valueKey = normalizeVariantAttributeValueKey(selectedValue?.key);
    if (valueKey !== undefined) {
      selected[attribute.key] = valueKey;
    }
  });
  return selected;
}

/** First variant-attribute axis collected from already-loaded child variants. */
export function getFirstVariantAttributeGroupFromChildren(product: Product): ProductVariantAttributeGroup | undefined {
  if (!product.variants?.length) {
    return undefined;
  }
  return collectVariantAttributeGroups(product, product.variants)[0];
}

/**
 * Values for `attributeKey` that exist on at least one sellable variant matching the
 * current selection on every other attribute axis (Figma unavailable = grayed chip).
 */
export function getCompatibleAttributeValues(
  variants: Product[],
  selectedAttributes: Record<string, string>,
  attributeKey: string,
): Set<string> {
  const compatible = new Set<string>();

  variants.forEach((variant) => {
    const values = getSelectedVariantAttributeValues(variant);
    const matchesOtherAxes = Object.entries(selectedAttributes).every(
      ([key, value]) => key === attributeKey || values[key] === value,
    );
    if (matchesOtherAxes && hasAttributeValue(values[attributeKey])) {
      compatible.add(values[attributeKey]);
    }
  });

  return compatible;
}

/** Per-attribute sets of values compatible with the current product selection. */
export function getCompatibleValuesByAttribute(
  variants: Product[],
  selectedAttributes: Record<string, string>,
  attributeKeys: string[],
): Record<string, Set<string>> {
  return attributeKeys.reduce<Record<string, Set<string>>>((acc, key) => {
    acc[key] = getCompatibleAttributeValues(variants, selectedAttributes, key);
    return acc;
  }, {});
}
