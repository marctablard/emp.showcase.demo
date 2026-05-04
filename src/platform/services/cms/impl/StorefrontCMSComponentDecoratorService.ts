import type { CMSComponentDecorator } from '@extensions/medienwerft-cms-plugin/services/CMSComponentDecoratorService';
import { AbstractCMSComponentDecoratorService } from '@extensions/medienwerft-cms-plugin/services/impl/AbstractCMSComponentDecoratorService';
import { inject } from 'inversify';
import type { DecoratedCategory } from '@/components/cms-custom/category-tile-row';
import { injectable } from '@/platform/core/di/injectable';
import type { CategoryService } from '@/platform/services/category/CategoryService';
import type { Category } from '@/platform/services/model/category';
import type { LocalizedString } from '@/platform/services/model/common';

const pickLocalized = (value: LocalizedString | undefined, locale: string): string | undefined => {
  if (!value) return undefined;
  return value[locale] ?? value.en ?? Object.values(value)[0];
};

const mapCategory = (category: Category, locale: string): DecoratedCategory => {
  const slug = pickLocalized(category.slug, locale);
  const firstMedia = category.media?.[0];
  return {
    id: category.id,
    name: pickLocalized(category.name, locale) ?? category.code ?? category.id,
    slug,
    path: slug ? `/category/${slug}` : undefined,
    image: firstMedia?.url
      ? {
          url: firstMedia.url,
          alt: typeof firstMedia.altText === 'string' ? firstMedia.altText : pickLocalized(firstMedia.altText, locale),
        }
      : undefined,
  };
};

const createCategoryRowDecorator = (categoryService: CategoryService): CMSComponentDecorator => {
  return async (component, { locale }) => {
    const ids: unknown = component.props?.category_ids;
    if (!Array.isArray(ids) || ids.length === 0) return { _categories: [] };
    const categories = await Promise.all(
      ids
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
        .map((id) => categoryService.getCategoryById(id).catch(() => null)),
    );
    const decorated: DecoratedCategory[] = [];
    for (const category of categories) {
      if (category) decorated.push(mapCategory(category, locale));
    }
    return { _categories: decorated };
  };
};

@injectable('EmporixCMSComponentDecoratorService', 'Singleton')
export class StorefrontCMSComponentDecoratorService extends AbstractCMSComponentDecoratorService {
  constructor(@inject('CategoryService') categoryService: CategoryService) {
    super({
      'cms-category-tile-row': createCategoryRowDecorator(categoryService),
    });
  }
}

export default StorefrontCMSComponentDecoratorService;
