import { injectable } from '@/platform/core/di/injectable';
import type { EmporixProduct, EmporixProductTemplate } from '@/platform/integrations/emporix/model/product';
import type { LocalizedString } from '@/platform/services/model/common';
import type {
  GroupedSpecification,
  Product,
  ProductSpecification,
  ProductTemplateAttributeType,
  ProductVariantAttribute,
} from '@/platform/services/model/product';
import type { ProductMapper } from '../ProductMapper';
import { normalizeLocalizedHighlights } from './normalizeLocalizedHighlights';
import { normalizeLocalizedLeaf } from './normalizeLocalizedLeaf';
import { normalizeProductAttributeStringMap } from './normalizeProductAttributeStringMap';

const TEMPLATE_ATTRIBUTE_TYPES = new Set<ProductTemplateAttributeType>(['TEXT', 'NUMBER', 'BOOLEAN', 'DATETIME']);

function asTemplateAttributeType(value: unknown): ProductTemplateAttributeType | undefined {
  return typeof value === 'string' && TEMPLATE_ATTRIBUTE_TYPES.has(value as ProductTemplateAttributeType)
    ? (value as ProductTemplateAttributeType)
    : undefined;
}

function resolveTemplateVersion(template: EmporixProductTemplate | undefined): string | undefined {
  const version = template?.version;
  if (typeof version === 'string' || typeof version === 'number') {
    return String(version);
  }
  const metadataVersion = template?.metadata?.version;
  if (typeof metadataVersion === 'string' || typeof metadataVersion === 'number') {
    return String(metadataVersion);
  }
  return undefined;
}

/** Labels + types from an expanded product template (`expand=template`). */
function mapTemplateAttributeMeta(template: EmporixProductTemplate | undefined): {
  labels?: Record<string, LocalizedString>;
  types?: Record<string, ProductTemplateAttributeType>;
} {
  if (!template?.attributes?.length) {
    return {};
  }

  const labels: Record<string, LocalizedString> = {};
  const types: Record<string, ProductTemplateAttributeType> = {};
  for (const attribute of template.attributes) {
    if (!attribute.key) {
      continue;
    }
    const name = normalizeLocalizedLeaf(attribute.name, attribute.key);
    if (name) {
      labels[attribute.key] = name;
    }
    const type = asTemplateAttributeType(attribute.type);
    if (type) {
      types[attribute.key] = type;
    }
  }

  return {
    ...(Object.keys(labels).length > 0 ? { labels } : {}),
    ...(Object.keys(types).length > 0 ? { types } : {}),
  };
}

/**
 * Implementation of ProductMapper for Emporix product data.
 * Maps between Emporix API product format and internal Product model.
 */
@injectable('EmporixProductMapper', 'Singleton')
export class EmporixProductMapper implements ProductMapper<EmporixProduct> {
  constructor() {}

  /**
   * Maps an Emporix product to the internal Product model.
   *
   * @param source - The Emporix product data
   * @returns The internal Product model
   */
  mapToService(source: EmporixProduct): Product {
    // Extract images from media array
    const images = source.media
      ? source.media.map((media) => ({
          url: media.url,
          altText: source.name,
          contentType: media.contentType,
        }))
      : [];

    const primaryImage = source.media ? source.media[0] : undefined;

    // Extract localized name and description
    const name = source.name || ''; // Add null/empty check
    const description = source.description || '';
    const templateAttributes = normalizeProductAttributeStringMap(
      source.mixins?.productTemplateAttributes as Record<string, unknown> | undefined,
    );
    const highlights = normalizeLocalizedHighlights(source.mixins?.highlights?.highlights);
    const mappedSpecs = !Array.isArray(source.mixins?.specifications?.specifications)
      ? []
      : source.mixins.specifications.specifications.map((rawSpec: unknown): ProductSpecification => {
          const spec =
            rawSpec !== null && typeof rawSpec === 'object' && !Array.isArray(rawSpec)
              ? (rawSpec as Record<string, unknown>)
              : {};
          // normalizeLocalizedLeaf() can return undefined for empty arrays/objects; only spread the
          // optional props when a defined value exists so we never emit { groupLabel: undefined }.
          const groupLabel = normalizeLocalizedLeaf(spec.groupLabel);
          const unit = normalizeLocalizedLeaf(spec.unit);
          const key = typeof spec.key === 'string' ? spec.key : '';
          // Schema is boolean | null — coerce null / missing to omitted (never emit highlight: undefined).
          const highlight = typeof spec.highlight === 'boolean' ? spec.highlight : undefined;
          return {
            key,
            label: normalizeLocalizedLeaf(spec.label, key) || { en: key },
            value: normalizeLocalizedLeaf(spec.value) || { en: '' },
            ...(typeof spec.group === 'string' && spec.group ? { group: spec.group } : {}),
            ...(groupLabel ? { groupLabel } : {}),
            ...(unit ? { unit } : {}),
            ...(typeof highlight === 'boolean' ? { highlight } : {}),
          };
        });

    // Also create a grouped version of specifications
    const groupedSpecifications = mappedSpecs.length > 0 ? this.groupSpecificationsByGroup(mappedSpecs) : [];
    const { labels: templateAttributeLabels, types: templateAttributeTypes } = mapTemplateAttributeMeta(
      source.template,
    );
    const templateVersion = resolveTemplateVersion(source.template);

    return {
      id: source.id || source.code,
      isParentVariant: source.productType === 'PARENT_VARIANT',
      parentVariantId: source.parentVariantId,
      categoryIds: source.categoryIds,
      brand: source.brandId ? { id: source.brandId } : undefined,
      labels: source.labelIds ? source.labelIds.map((id) => ({ id })) : undefined,
      name,
      description,
      primaryImage,
      images,
      specifications: mappedSpecs,
      groupedSpecifications: groupedSpecifications,
      highlights,
      ...(source.template?.id
        ? {
            template: {
              id: source.template.id,
              ...(templateVersion ? { version: templateVersion } : {}),
            },
          }
        : {}),
      templateAttributes,
      ...(templateAttributeLabels ? { templateAttributeLabels } : {}),
      ...(templateAttributeTypes ? { templateAttributeTypes } : {}),
      variantAttributes: this.mapVariantAttributes(source),
      purchasable: source.productType !== 'PARENT_VARIANT',
      variantAttributeValues: normalizeProductAttributeStringMap(
        source.mixins?.productVariantAttributes as Record<string, unknown> | undefined,
      ),
    };
  }

  /**
   * Groups specifications by their group property
   * @param specifications - Array of product specifications
   * @returns Array of grouped specifications
   */
  groupSpecificationsByGroup(specifications: ProductSpecification[]): GroupedSpecification[] {
    const groupedByKey: Record<string, ProductSpecification[]> = {};

    specifications.forEach((spec) => {
      const group = spec.group || 'other';
      if (!groupedByKey[group]) {
        groupedByKey[group] = [];
      }
      groupedByKey[group].push(spec);
    });

    return Object.entries(groupedByKey).map(([group, specs]) => {
      const firstSpec = specs[0];
      const groupName = firstSpec.groupLabel || group.charAt(0).toUpperCase() + group.slice(1);

      const items = specs.map((spec) => {
        const label = spec.label || spec.key;
        const value = spec.value || '';
        const unit = spec.unit || '';

        return { label, value, unit };
      });

      return {
        groupName,
        item: items,
      };
    });
  }

  /**
   * Maps an internal Product model back to Emporix product format.
   *
   * @param service - The internal Product model
   * @returns The Emporix product data
   */
  mapToSource(service: Product): EmporixProduct {
    // Convert images array to media objects
    const media = service.images
      ? service.images.map((image, ix) => ({
          id: service.id + '-' + ix,
          url: image.url,
          altText: image.altText,
          tags: [],
          contentType: 'image/jpeg', // Assuming JPEG format, adjust as needed
        }))
      : [];

    return {
      id: service.id,
      code: service.id, // Using id as code since it's required
      name: service.name,
      description: service.description,
      media: media,
      published: true,
      ...(service.categoryIds?.length ? { categoryIds: service.categoryIds } : {}),
    };
  }

  mapVariantAttributes(source: EmporixProduct): ProductVariantAttribute[] {
    const variantAttributes =
      source.productType === 'PARENT_VARIANT' ? source.variantAttributes : source.parentVariant?.variantAttributes;
    if (!variantAttributes) {
      return [];
    }
    return Object.keys(variantAttributes).map((key) => {
      const selectedMixinValue = source.mixins?.productVariantAttributes?.[key];
      const selectedKey =
        selectedMixinValue === null || selectedMixinValue === undefined ? undefined : String(selectedMixinValue);
      const values = variantAttributes[key]
        .map((value) => {
          // Product Service may return numeric/boolean value keys (e.g. width: 15).
          const valueKey = String(value.key);
          return {
            key: valueKey,
            selected: source.productType === 'VARIANT' ? selectedKey === valueKey : false,
          };
        })
        .filter((value) => value.key.length > 0);
      const name = normalizeLocalizedLeaf(source.template?.attributes?.find((attr) => attr.key === key)?.name, key);
      return {
        key: key,
        name: name ?? key,
        values: values,
      };
    });
  }
}

export default EmporixProductMapper;
