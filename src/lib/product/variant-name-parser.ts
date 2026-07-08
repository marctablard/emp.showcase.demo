import type { LocalizedString } from '@/platform/services/model/common';
import type { Product, ProductSpecification, ProductVariantAttribute } from '@/platform/services/model/product';

const DIMENSIONS_KEY = 'dimensions';
const MATERIAL_KEY = 'material';
const CONFIGURATION_KEY = 'configuration';

function getProductName(product: Product): string {
  if (typeof product.name === 'string') {
    return product.name;
  }
  return product.name?.en || product.name?.de || Object.values(product.name ?? {})[0] || product.id;
}

function localizedValue(value: LocalizedString | string | undefined): string {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return (value.en || value.de || Object.values(value)[0] || '').trim();
}

function compareAttributeValues(a: string, b: string): number {
  const aNum = Number(a);
  const bNum = Number(b);
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
    return aNum - bNum;
  }
  return a.localeCompare(b);
}

function buildAttributeDefinitions(
  valueSets: Record<string, Set<string>>,
  labelByKey: Record<string, LocalizedString>,
  attributeMaps: Map<string, Record<string, string>>,
  selectedVariantId?: string,
): ProductVariantAttribute[] {
  const selectedMap = selectedVariantId ? attributeMaps.get(selectedVariantId) : undefined;

  return Object.keys(valueSets)
    .filter((key) => valueSets[key].size > 0)
    .map((key) => ({
      key,
      name: labelByKey[key] || key,
      values: Array.from(valueSets[key])
        .sort(compareAttributeValues)
        .map((value) => ({
          key: value,
          name: value,
          selected: selectedMap?.[key] === value,
        })),
    }));
}

/**
 * HASCO-style dynamic variants encode selectable values in the product name:
 * e.g. "K10/100x130x22/1.1730" → dimensions + material.
 */
export function parseVariantNameAttributes(name: string): Record<string, string> | null {
  const segments = name
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length < 3) {
    return null;
  }

  const dimensions = segments[segments.length - 2];
  const material = segments[segments.length - 1];

  if (!/\d/.test(dimensions) || !/^\d+\.\d+/.test(material)) {
    return null;
  }

  return {
    [DIMENSIONS_KEY]: dimensions,
    [MATERIAL_KEY]: material,
  };
}

export function inferVariantAttributesFromNames(
  variants: Product[],
  selectedVariantId?: string,
): {
  attributeDefinitions: ProductVariantAttribute[];
  attributeMaps: Map<string, Record<string, string>>;
} {
  const attributeMaps = new Map<string, Record<string, string>>();
  const valueSets: Record<string, Set<string>> = {
    [DIMENSIONS_KEY]: new Set(),
    [MATERIAL_KEY]: new Set(),
  };

  variants.forEach((variant) => {
    const parsed = parseVariantNameAttributes(getProductName(variant));
    if (!parsed) {
      return;
    }
    attributeMaps.set(variant.id, parsed);
    valueSets[DIMENSIONS_KEY].add(parsed[DIMENSIONS_KEY]);
    valueSets[MATERIAL_KEY].add(parsed[MATERIAL_KEY]);
  });

  if (attributeMaps.size === 0) {
    return { attributeDefinitions: [], attributeMaps };
  }

  const labels: Record<string, LocalizedString> = {
    [DIMENSIONS_KEY]: { en: 'Dimensions (mm)', de: 'Abmessungen (mm)' },
    [MATERIAL_KEY]: { en: 'Material', de: 'Material' },
  };

  return {
    attributeDefinitions: buildAttributeDefinitions(valueSets, labels, attributeMaps, selectedVariantId),
    attributeMaps,
  };
}

function getSpecificationEntries(variant: Product, highlightedOnly: boolean): ProductSpecification[] {
  const specifications = variant.specifications ?? [];
  if (highlightedOnly) {
    return specifications.filter((spec) => spec.highlight);
  }
  return specifications;
}

export function inferVariantAttributesFromSpecifications(
  variants: Product[],
  selectedVariantId?: string,
  highlightedOnly = true,
): {
  attributeDefinitions: ProductVariantAttribute[];
  attributeMaps: Map<string, Record<string, string>>;
} {
  const attributeMaps = new Map<string, Record<string, string>>();
  const valueSets: Record<string, Set<string>> = {};
  const labelByKey: Record<string, LocalizedString> = {};

  variants.forEach((variant) => {
    const specs = getSpecificationEntries(variant, highlightedOnly);
    if (specs.length === 0) {
      return;
    }

    const map: Record<string, string> = {};
    specs.forEach((spec) => {
      const value = localizedValue(spec.value);
      if (!value) {
        return;
      }
      map[spec.key] = value;
      if (!valueSets[spec.key]) {
        valueSets[spec.key] = new Set();
      }
      valueSets[spec.key].add(value);
      if (!labelByKey[spec.key]) {
        labelByKey[spec.key] = spec.label;
      }
    });

    if (Object.keys(map).length > 0) {
      attributeMaps.set(variant.id, map);
    }
  });

  if (attributeMaps.size === 0) {
    return { attributeDefinitions: [], attributeMaps };
  }

  const varyingKeys = Object.keys(valueSets).filter((key) => valueSets[key].size > 1);
  const keysToUse = varyingKeys.length > 0 ? varyingKeys : Object.keys(valueSets);

  const filteredValueSets = keysToUse.reduce<Record<string, Set<string>>>((acc, key) => {
    acc[key] = valueSets[key];
    return acc;
  }, {});

  return {
    attributeDefinitions: buildAttributeDefinitions(filteredValueSets, labelByKey, attributeMaps, selectedVariantId),
    attributeMaps,
  };
}

/**
 * Fallback for short names that share a common prefix, e.g. A8005/1x1 … A8005/1x5.
 */
export function inferVariantAttributesFromNameSuffix(
  variants: Product[],
  selectedVariantId?: string,
): {
  attributeDefinitions: ProductVariantAttribute[];
  attributeMaps: Map<string, Record<string, string>>;
} {
  const names = variants.map((variant) => getProductName(variant)).filter(Boolean);
  if (names.length < 2) {
    return { attributeDefinitions: [], attributeMaps: new Map() };
  }

  let prefixLength = 0;
  const shortest = Math.min(...names.map((name) => name.length));
  while (prefixLength < shortest && names.every((name) => name[prefixLength] === names[0][prefixLength])) {
    prefixLength += 1;
  }

  const suffixes = names.map((name) => name.slice(prefixLength).trim()).filter(Boolean);
  if (suffixes.length < 2 || new Set(suffixes).size < 2) {
    return { attributeDefinitions: [], attributeMaps: new Map() };
  }

  const attributeMaps = new Map<string, Record<string, string>>();
  const valueSets: Record<string, Set<string>> = { [CONFIGURATION_KEY]: new Set() };

  variants.forEach((variant) => {
    const name = getProductName(variant);
    const suffix = name.slice(prefixLength).trim();
    if (!suffix) {
      return;
    }
    attributeMaps.set(variant.id, { [CONFIGURATION_KEY]: suffix });
    valueSets[CONFIGURATION_KEY].add(suffix);
  });

  const labels: Record<string, LocalizedString> = {
    [CONFIGURATION_KEY]: { en: 'Configuration', de: 'Konfiguration' },
  };

  return {
    attributeDefinitions: buildAttributeDefinitions(valueSets, labels, attributeMaps, selectedVariantId),
    attributeMaps,
  };
}

export function inferVariantAttributes(
  variants: Product[],
  selectedVariantId?: string,
): {
  attributeDefinitions: ProductVariantAttribute[];
  attributeMaps: Map<string, Record<string, string>>;
} {
  if (variants.length === 0) {
    return { attributeDefinitions: [], attributeMaps: new Map() };
  }

  const fromNames = inferVariantAttributesFromNames(variants, selectedVariantId);
  if (fromNames.attributeDefinitions.length > 0) {
    return fromNames;
  }

  const fromHighlightedSpecs = inferVariantAttributesFromSpecifications(variants, selectedVariantId, true);
  if (fromHighlightedSpecs.attributeDefinitions.length > 0) {
    return fromHighlightedSpecs;
  }

  const fromAllSpecs = inferVariantAttributesFromSpecifications(variants, selectedVariantId, false);
  if (fromAllSpecs.attributeDefinitions.length > 0) {
    return fromAllSpecs;
  }

  return inferVariantAttributesFromNameSuffix(variants, selectedVariantId);
}

export function applyInferredVariantAttributes(
  product: Product,
  attributeDefinitions: ProductVariantAttribute[],
  attributeMaps: Map<string, Record<string, string>>,
): Product {
  if (attributeDefinitions.length === 0) {
    return product;
  }

  const selectedMap = attributeMaps.get(product.id);
  const variantAttributes = attributeDefinitions.map((attribute) => ({
    ...attribute,
    values: attribute.values.map((value) => ({
      ...value,
      selected: selectedMap?.[attribute.key] === value.key,
    })),
  }));

  return {
    ...product,
    variantAttributes,
    variantAttributeValues: selectedMap,
  };
}

export function enrichProductsWithInferredVariantAttributes(
  products: Product[],
  selectedVariantId?: string,
): Product[] {
  if (products.length === 0) {
    return products;
  }

  const needsInference = products.some(
    (product) => !product.variantAttributes || product.variantAttributes.length === 0,
  );

  if (!needsInference) {
    return products;
  }

  const { attributeDefinitions, attributeMaps } = inferVariantAttributes(products, selectedVariantId);
  if (attributeDefinitions.length === 0) {
    return products;
  }

  return products.map((product) => applyInferredVariantAttributes(product, attributeDefinitions, attributeMaps));
}
