import { injectable } from '@/platform/core/di/injectable';
import { EmporixCategory } from '@/platform/integrations/emporix/model';
import { Category } from '@/platform/services/model/category';
import { CategoryMapper } from '../CategoryMapper';

/**
 * Specialized mapper for transforming Emporix category data to internal Category model.
 */
@injectable('EmporixCategoryMapper', 'Singleton')
class EmporixCategoryMapper implements CategoryMapper<EmporixCategory> {
  mapToService(source: EmporixCategory): Category {
    // /category-trees returns localizedName for the localized map; other endpoints
    // may return name as a plain string or as a localized map. Prefer localizedName.
    const name = source.localizedName ?? source.name ?? {};
    const description = source.localizedDescription ?? source.description;
    const slug = source.localizedSlug ?? source.slug;

    // /category-trees nests children under "subcategories"; other endpoints use "children"
    const nested = source.subcategories ?? source.children;

    return {
      id: source.id,
      code: source.code,
      name: name as Category['name'],
      description: description as Category['description'],
      shortDescription: source.shortDescription,
      slug: slug as Category['slug'],
      published: source.published,
      visible: source.visible,
      parent: source.parentId,
      position: source.position,
      children: nested?.map((child) => this.mapToService(child)),
      media: source.media,
      metadata: source.metadata,
      mixins: source.mixins,
      customAttributes: source.customAttributes,
    };
  }

  mapToSource(_service: Category): EmporixCategory {
    throw new Error('Method not implemented.');
  }
}

export default EmporixCategoryMapper;
