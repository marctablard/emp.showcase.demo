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
