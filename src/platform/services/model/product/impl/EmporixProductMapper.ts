import { injectable } from '@/platform/core/di/injectable';
import type { EmporixProduct } from '@/platform/integrations/emporix/model/product';
import type {
  GroupedSpecification,
  Product,
  ProductSpecification,
  ProductVariantAttribute,
} from '@/platform/services/model/product';
import type { ProductMapper } from '../ProductMapper';
import { normalizeLocalizedHighlights } from './normalizeLocalizedHighlights';
import { normalizeLocalizedLeaf } from './normalizeLocalizedLeaf';
import { normalizeProductAttributeStringMap } from './normalizeProductAttributeStringMap';

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
            ...(highlight !== undefined ? { highlight } : {}),
          };
        });

    // Also create a grouped version of specifications
    const groupedSpecifications = mappedSpecs.length > 0 ? this.groupSpecificationsByGroup(mappedSpecs) : [];

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
      templateAttributes,
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
      const values = variantAttributes[key].map((value) => {
        return {
          key: value.key,
          selected:
            source.productType === 'VARIANT' ? source.mixins?.productVariantAttributes[key] === value.key : false,
        };
      });
      const name = source.template?.attributes?.find((attr) => attr.key === key)?.name || key;
      return {
        key: key,
        name: name,
        values: values,
      };
    });
  }
}

export default EmporixProductMapper;
