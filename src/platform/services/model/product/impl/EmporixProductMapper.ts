import { injectable } from '@/platform/core/di/injectable';
import type { EmporixProduct } from '@/platform/integrations/emporix/model/product';
import type { LocalizedString } from '@/platform/services/model/common';
import type {
  GroupedSpecification,
  Product,
  ProductSpecification,
  ProductVariantAttribute,
} from '@/platform/services/model/product';
import type { ProductMapper } from '../ProductMapper';
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
    const highlights = source.mixins?.highlights?.highlights?.map((highlight: any) => highlight.value);
    const mappedSpecs = !source.mixins?.specifications?.specifications
      ? []
      : source.mixins?.specifications?.specifications.map((spec: any) => ({
          key: spec.key,
          group: spec.group,
          groupLabel: spec.groupLabel
            ? spec.groupLabel.reduce((acc: LocalizedString, item: any) => {
                acc[item.language] = item.value;
                return acc;
              }, {} as any)
            : {},
          label:
            spec.label && Array.isArray(spec.label)
              ? spec.label.reduce((acc: LocalizedString, item: any) => {
                  acc[item.language] = item.value;
                  return acc;
                }, {} as any)
              : { en: spec.key || '' },
          value:
            spec.value && Array.isArray(spec.value)
              ? spec.value.reduce((acc: LocalizedString, item: any) => {
                  acc[item.language] = item.value;
                  return acc;
                }, {} as any)
              : { en: '' },
          ...(spec.unit &&
            Array.isArray(spec.unit) && {
              unit: spec.unit.reduce((acc: LocalizedString, item: any) => {
                acc[item.language] = item.value;
                return acc;
              }, {} as any),
            }),
        }));

    // Also create a grouped version of specifications
    const groupedSpecifications = mappedSpecs.length > 0 ? this.groupSpecificationsByGroup(mappedSpecs) : [];

    return {
      id: source.id || source.code,
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
