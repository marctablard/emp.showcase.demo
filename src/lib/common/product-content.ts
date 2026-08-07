import type { LocalizedString } from '@/platform/services/model/common';
import type { GroupedSpecification, Product, ProductSpecification } from '@/platform/services/model/product';

export const KEY_SPEC_BASIC_GROUP_ID = 'basic-specifications';
export const TECHNICAL_INFO_BASIC_GROUP_ID = 'basic-attributes';

export interface KeySpecificationGroup {
  id: string;
  /** Present when flagged specs span multiple groups, or for the Basic Specifications block. */
  groupName?: string | LocalizedString;
  items: ProductSpecification[];
}

function isNonEmptyLocalized(value: string | LocalizedString | undefined | null): boolean {
  if (value == null) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return Object.values(value).some((entry) => typeof entry === 'string' && entry.trim().length > 0);
}

function templateAttributesToSpecs(
  templateAttributes: Record<string, string> | undefined,
  templateAttributeLabels?: Record<string, LocalizedString>,
): ProductSpecification[] {
  if (!templateAttributes) {
    return [];
  }

  return Object.entries(templateAttributes)
    .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    .map(([key, value]) => ({
      key: `template-${key}`,
      // Prefer Product Templates API localized names; fall back to the attribute key.
      label: templateAttributeLabels?.[key] ?? { en: key },
      value: { en: value },
    }));
}

function templateAttributesToGroupedItems(
  templateAttributes: Record<string, string> | undefined,
  templateAttributeLabels?: Record<string, LocalizedString>,
): GroupedSpecification['item'] {
  return templateAttributesToSpecs(templateAttributes, templateAttributeLabels).map((spec) => ({
    label: spec.label,
    value: spec.value,
    unit: '',
    attributeKey: spec.key.startsWith('template-') ? spec.key.slice('template-'.length) : undefined,
  }));
}

function groupFlatSpecifications(specifications: ProductSpecification[]): KeySpecificationGroup[] {
  const hasAnyGroupMeta = specifications.some(
    (spec) => isNonEmptyLocalized(spec.groupLabel) || (typeof spec.group === 'string' && spec.group.trim().length > 0),
  );

  if (!hasAnyGroupMeta) {
    return [{ id: 'flagged', items: specifications }];
  }

  const byGroup = new Map<string, { groupName?: string | LocalizedString; items: ProductSpecification[] }>();

  specifications.forEach((spec, index) => {
    const groupKey =
      (typeof spec.group === 'string' && spec.group.trim()) ||
      (isNonEmptyLocalized(spec.groupLabel) ? JSON.stringify(spec.groupLabel) : `ungrouped-${index}`);
    const existing = byGroup.get(groupKey);
    if (existing) {
      existing.items.push(spec);
      return;
    }
    byGroup.set(groupKey, {
      groupName: isNonEmptyLocalized(spec.groupLabel)
        ? spec.groupLabel
        : typeof spec.group === 'string' && spec.group.trim()
          ? spec.group
          : undefined,
      items: [spec],
    });
  });

  return [...byGroup.entries()].map(([id, group]) => ({
    id,
    ...(group.groupName ? { groupName: group.groupName } : {}),
    items: group.items,
  }));
}

/**
 * Spec groups for the PDP Key specifications card.
 *
 * - `product.specifications` with `highlight: true` only (grouped when 2+ groups)
 * - `product.templateAttributes` as the “Basic Specifications” group (id sentinel)
 */
export function getKeySpecificationGroups(product: Product): KeySpecificationGroup[] {
  const flagged = (product.specifications ?? []).filter((spec) => spec.highlight === true);
  const groups: KeySpecificationGroup[] = flagged.length > 0 ? groupFlatSpecifications(flagged) : [];

  // Single flagged group: omit group label chrome (caller also hides headers when groups.length === 1).
  if (groups.length === 1) {
    groups[0] = { id: groups[0].id, items: groups[0].items };
  }

  const basicItems = templateAttributesToSpecs(product.templateAttributes, product.templateAttributeLabels);
  if (basicItems.length > 0) {
    groups.push({
      id: KEY_SPEC_BASIC_GROUP_ID,
      // Marker for UI translation — not passed through l10n as product copy.
      groupName: KEY_SPEC_BASIC_GROUP_ID,
      items: basicItems,
    });
  }

  return groups;
}

/** Flat list of key-spec items (all groups concatenated). */
export function getKeySpecifications(product: Product): ProductSpecification[] {
  return getKeySpecificationGroups(product).flatMap((group) => group.items);
}

/**
 * Whether the PDP Key specifications heading + list have anything to render.
 */
export function hasKeySpecifications(product: Product): boolean {
  return getKeySpecifications(product).length > 0;
}

/**
 * Technical Information columns: Basic Attributes (templateAttributes) first, then all
 * `groupedSpecifications` groups.
 */
export function getTechnicalInformationGroups(product: Product): GroupedSpecification[] {
  const groups: GroupedSpecification[] = [];
  const basicItems = templateAttributesToGroupedItems(product.templateAttributes, product.templateAttributeLabels);

  if (basicItems.length > 0) {
    groups.push({
      groupName: TECHNICAL_INFO_BASIC_GROUP_ID,
      item: basicItems,
    });
  }

  for (const group of product.groupedSpecifications ?? []) {
    if (group.item.length > 0) {
      groups.push(group);
    }
  }

  return groups;
}

/**
 * Whether the active locale has at least one Product Highlights bullet.
 * `{ en: [] }` and a missing locale key are both empty for that locale.
 */
export function hasLocalizedHighlights(product: Product, locale: string): boolean {
  return (product.highlights?.[locale]?.length ?? 0) > 0;
}

/**
 * Whether Technical Information has content (grouped specs and/or template attributes).
 */
export function hasTechnicalInformation(product: Product): boolean {
  return getTechnicalInformationGroups(product).length > 0;
}
