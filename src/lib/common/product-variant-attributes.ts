import type { Product, ProductVariantAttribute } from '@/platform/services/model/product';

/** Parent, child, or any product that already carries variant-family data. */
export function isVariantFamilyProduct(product: Product): boolean {
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

/**
 * Collect unique variant attribute values across all sellable variants,
 * ordered by the parent product's `variantAttributes` definition when present.
 */
export function collectVariantAttributeGroups(product: Product, variants: Product[]): ProductVariantAttributeGroup[] {
  const valuesByKey = new Map<string, Set<string>>();
  const nameByKey = new Map<string, ProductVariantAttribute['name']>();

  const rememberName = (attribute: ProductVariantAttribute): void => {
    if (attribute.name != null && !nameByKey.has(attribute.key)) {
      nameByKey.set(attribute.key, attribute.name);
    }
  };

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

  product.variantAttributes?.forEach(rememberName);

  // Possible values come from sellable variants (selected value on each attribute axis).
  variants.forEach((variant) => {
    variant.variantAttributes?.forEach((attribute) => {
      rememberName(attribute);
      attribute.values?.forEach((value) => {
        if (value.selected) {
          addValue(attribute.key, value.key);
        }
      });
    });
    Object.entries(variant.variantAttributeValues ?? {}).forEach(([key, value]) => {
      addValue(key, value);
    });
  });

  // Fallback: if variants lack attribute payloads, use the parent's value catalog.
  if (valuesByKey.size === 0) {
    product.variantAttributes?.forEach((attribute) => {
      attribute.values?.forEach((value) => {
        addValue(attribute.key, value.key);
      });
    });
  }

  const orderedKeys =
    product.variantAttributes && product.variantAttributes.length > 0
      ? product.variantAttributes.map((attribute) => attribute.key)
      : [...valuesByKey.keys()];

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

/** Selected attribute value keys for a variant (key → value key). */
export function getSelectedVariantAttributeValues(variant: Product): Record<string, string> {
  const selected: Record<string, string> = {};
  variant.variantAttributes?.forEach((attribute) => {
    const selectedValue = attribute.values?.find((value) => value.selected);
    const valueKey = normalizeVariantAttributeValueKey(selectedValue?.key);
    if (valueKey !== undefined) {
      selected[attribute.key] = valueKey;
    }
  });
  Object.entries(variant.variantAttributeValues ?? {}).forEach(([key, value]) => {
    if (selected[key] !== undefined) {
      return;
    }
    const valueKey = normalizeVariantAttributeValueKey(value);
    if (valueKey !== undefined) {
      selected[key] = valueKey;
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
    if (matchesOtherAxes && values[attributeKey]) {
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
