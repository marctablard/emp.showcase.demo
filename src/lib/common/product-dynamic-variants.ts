import {
  type ProductVariantAttributeGroup,
  type VariantAttributeFilters,
  getCompatibleAttributeValues,
  getSelectedVariantAttributeValues,
  normalizeVariantAttributeValueKey,
  variantFilterValues,
} from '@/lib/common/product-variant-attributes';
import type { Product, ProductVariantAttribute } from '@/platform/services/model/product';

/** Identity fields used to resolve the first DYNAMIC_VARIANT root GET candidate. */
export type DynamicVariantIdentity = Pick<Product, 'id' | 'parentVariantId' | 'parentVariantPath'>;

/** Family member fields needed for sellable-list membership. */
export type DynamicSellableMember = Pick<Product, 'id' | 'sellable'>;

/**
 * First storefront-view GET candidate for a DYNAMIC_VARIANT node.
 *
 * OpenAPI `parentVariantPath`: index 0 = direct parent, last index = root.
 * The Product tutorial JSON example is root-first and is not the oracle.
 */
export function resolveDynamicRootId(product: DynamicVariantIdentity): string {
  const rootId = product.parentVariantPath?.at(-1);
  if (rootId) {
    return rootId;
  }
  return product.id;
}

/**
 * Sellable-list membership: `sellable === true`, plus the opened member when that
 * node is non-sellable (disabled-card exception).
 */
export function filterSellableDynamicMembers<T extends DynamicSellableMember>(members: T[], openedId: string): T[] {
  return members.filter((member) => member.sellable === true || member.id === openedId);
}

function rememberDynamicAttributeName(
  nameByKey: Map<string, ProductVariantAttribute['name']>,
  attribute: Pick<ProductVariantAttribute, 'key' | 'name'>,
): void {
  if (attribute.name == null || nameByKey.has(attribute.key)) {
    return;
  }
  nameByKey.set(attribute.key, attribute.name);
}

/**
 * Union of attribute axes used anywhere in the family (including keys that exist
 * only on some descendants, e.g. Frequency).
 */
export function unionDynamicVariantAttributes(members: Product[]): ProductVariantAttributeGroup[] {
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

  members.forEach((member) => {
    member.variantAttributes?.forEach((attribute) => {
      rememberDynamicAttributeName(nameByKey, attribute);
      attribute.values?.forEach((value) => addValue(attribute.key, value.key));
    });
    Object.entries(member.variantAttributeValues ?? {}).forEach(([key, value]) => {
      addValue(key, value);
    });
  });

  const groups: ProductVariantAttributeGroup[] = [];
  valuesByKey.forEach((values, key) => {
    if (values.size === 0) {
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
 * True when the member's selected qualifiers match every provided axis.
 * Qualifiers are compared as normalized strings (`15` and `15` number → `"15"`).
 */
export function dynamicMemberMatchesQualifiers(member: Product, selectedQualifiers: VariantAttributeFilters): boolean {
  const values = getSelectedVariantAttributeValues(member);
  return Object.entries(selectedQualifiers).every(([attributeKey, raw]) => {
    const selected = variantFilterValues(raw)
      .map((value) => normalizeVariantAttributeValueKey(value))
      .filter((value): value is string => value !== undefined);
    if (selected.length === 0) {
      return true;
    }
    const memberValue = values[attributeKey];
    return memberValue !== undefined && selected.includes(memberValue);
  });
}

/**
 * Family members whose selected qualifiers match the current chip selection.
 * Compatible-value math stays on `getCompatibleAttributeValues`.
 */
export function filterDynamicMembersByQualifiers(
  members: Product[],
  selectedQualifiers: VariantAttributeFilters,
): Product[] {
  return members.filter((member) => dynamicMemberMatchesQualifiers(member, selectedQualifiers));
}

/** Values for `attributeKey` that remain possible under the current qualifier selection. */
export function getCompatibleDynamicAttributeValues(
  members: Product[],
  selectedQualifiers: Record<string, string>,
  attributeKey: string,
): Set<string> {
  return getCompatibleAttributeValues(members, selectedQualifiers, attributeKey);
}
