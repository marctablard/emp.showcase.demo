import type { Product } from '@/platform/services/model/product';

export function getVariantAttributeMap(variant: Product): Record<string, string> {
  if (variant.variantAttributeValues && Object.keys(variant.variantAttributeValues).length > 0) {
    return { ...variant.variantAttributeValues };
  }

  const attributes: Record<string, string> = {};

  variant.variantAttributes?.forEach((variantAttribute) => {
    const selectedValue = variantAttribute.values?.find((value) => value.selected);
    if (selectedValue) {
      attributes[variantAttribute.key] = selectedValue.key;
    }
  });

  return attributes;
}

export function getDefaultSelectedAttributes(product: Product): Record<string, string> {
  const configurableKeys = product.variantAttributes?.map((attribute) => attribute.key) ?? [];

  const allValues: Record<string, string> =
    product.variantAttributeValues && Object.keys(product.variantAttributeValues).length > 0
      ? { ...product.variantAttributeValues }
      : (product.variantAttributes ?? []).reduce<Record<string, string>>((acc, variantAttribute) => {
          const selectedValue = variantAttribute.values?.find((value) => value.selected);
          if (selectedValue) {
            acc[variantAttribute.key] = selectedValue.key;
          }
          return acc;
        }, {});

  if (configurableKeys.length === 0) {
    return allValues;
  }

  return Object.fromEntries(Object.entries(allValues).filter(([key]) => configurableKeys.includes(key)));
}

export function buildAvailableAttributeValues(variants: Product[]): Record<string, Set<string>> {
  const availableValues: Record<string, Set<string>> = {};

  variants.forEach((variant) => {
    Object.entries(getVariantAttributeMap(variant)).forEach(([key, value]) => {
      if (!availableValues[key]) {
        availableValues[key] = new Set();
      }
      availableValues[key].add(value);
    });
  });

  return availableValues;
}

export function buildFilteredAttributeValues(
  variants: Product[],
  selectedAttributes: Record<string, string>,
  availableValues: Record<string, Set<string>>,
): Record<string, Set<string>> {
  const filteredValues: Record<string, Set<string>> = {};

  Object.keys(availableValues).forEach((attributeKey) => {
    filteredValues[attributeKey] = new Set(availableValues[attributeKey]);
  });

  if (Object.keys(selectedAttributes).length === 0) {
    return filteredValues;
  }

  Object.keys(availableValues).forEach((targetAttributeKey) => {
    const validValues = new Set<string>();

    variants.forEach((variant) => {
      const variantAttributes = getVariantAttributeMap(variant);
      const matchesSelection = Object.entries(selectedAttributes).every(([key, value]) => {
        if (key === targetAttributeKey) {
          return true;
        }
        return variantAttributes[key] === value;
      });

      if (matchesSelection && variantAttributes[targetAttributeKey]) {
        validValues.add(variantAttributes[targetAttributeKey]);
      }
    });

    filteredValues[targetAttributeKey] = validValues;
  });

  return filteredValues;
}

export function filterVariantsBySelection(variants: Product[], selectedAttributes: Record<string, string>): Product[] {
  const selectedEntries = Object.entries(selectedAttributes).filter(([, value]) => value);

  if (selectedEntries.length === 0) {
    return variants;
  }

  return variants.filter((variant) => {
    const variantAttributes = getVariantAttributeMap(variant);
    return selectedEntries.every(([key, value]) => variantAttributes[key] === value);
  });
}

export function findMatchingVariant(
  variants: Product[],
  selectedAttributes: Record<string, string>,
): Product | undefined {
  const selectedEntries = Object.entries(selectedAttributes).filter(([, value]) => value);

  if (selectedEntries.length === 0) {
    return undefined;
  }

  return variants.find((variant) => {
    const variantAttributes = getVariantAttributeMap(variant);
    return selectedEntries.every(([key, value]) => variantAttributes[key] === value);
  });
}

export function isColorAttributeKey(key: string): boolean {
  return key === 'color' || key === 'farbe';
}

/**
 * Dynamic variant families use the configurator UI. Classic PARENT_VARIANT / VARIANT
 * products with template-driven attributes keep the legacy tile/dropdown selectors.
 */
export function isVariantConfiguratorProduct(
  product: Pick<Product, 'variantAttributes' | 'parentVariantId' | 'id' | 'productType'>,
): boolean {
  if (product.productType === 'BASIC' || product.productType === 'BUNDLE') {
    return false;
  }

  if (product.productType === 'DYNAMIC_VARIANT') {
    return true;
  }

  if (
    (product.productType === 'PARENT_VARIANT' || product.productType === 'VARIANT') &&
    product.variantAttributes?.length
  ) {
    return false;
  }

  if (product.variantAttributes?.length || product.parentVariantId) {
    return true;
  }

  if (product.productType === 'VARIANT' || product.productType === 'PARENT_VARIANT') {
    return product.id.includes('-');
  }

  return false;
}
