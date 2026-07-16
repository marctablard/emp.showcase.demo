import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCategory, EmporixCategoryTree } from '@/platform/integrations/emporix/model';
import type { Category } from '@/platform/services/model/category';
import type { CategoryMapper } from '../CategoryMapper';

function sortCategoryTreeByPosition(a: EmporixCategoryTree, b: EmporixCategoryTree): number {
  const aPosition = a.position;
  const bPosition = b.position;

  if (aPosition === undefined && bPosition === undefined) return 0;
  if (aPosition === undefined) return 1;
  if (bPosition === undefined) return -1;

  if (aPosition === 0 && bPosition === 0) return 0;
  if (aPosition === 0) return 1;
  if (bPosition === 0) return -1;

  return aPosition - bPosition;
}

/**
 * Maps GET /category-trees nodes (localized* + subcategories) to domain {@link Category}.
 */
export function mapEmporixCategoryTreeToCategory(node: EmporixCategoryTree): Category {
  const sortedSubs = (node.subcategories ?? []).slice().sort(sortCategoryTreeByPosition);
  const children =
    sortedSubs.length > 0 ? sortedSubs.map((child) => mapEmporixCategoryTreeToCategory(child)) : undefined;

  return {
    id: node.id,
    code: node.code,
    name: node.localizedName,
    description: node.localizedDescription,
    slug: node.localizedSlug,
    published: node.published,
    parent: node.parentId,
    position: node.position,
    ...(children && children.length > 0 ? { children } : {}),
  };
}

/**
 * Specialized mapper for transforming Emporix category data to internal Category model.
 */
@injectable('EmporixCategoryMapper', 'Singleton')
class EmporixCategoryMapper implements CategoryMapper<EmporixCategory> {
  mapToService(source: EmporixCategory): Category {
    return {
      id: source.id,
      code: source.code,
      name: source.name,
      description: source.description,
      shortDescription: source.shortDescription,
      slug: source.slug,
      published: source.published,
      visible: source.visible,
      parent: source.parentId,
      position: source.position,
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
