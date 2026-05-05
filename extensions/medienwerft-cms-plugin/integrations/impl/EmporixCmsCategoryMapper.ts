import { injectable } from '@/platform/core/di/injectable';
import type { Category } from '@/platform/services/model/category';
import type { EmporixCmsCategory } from '../model/EmporixCmsCategory';

/**
 * Maps a v2 `EmporixCmsCategory` (the rich, possibly-nested shape returned
 * by the v2 Emporix endpoints) into the platform's flat `Category` model
 * augmented with `children`.
 *
 * Localized fields prefer the v2 `localized*` maps and fall back to the
 * legacy v1 fields, mirroring how the v2 endpoint actually populates the
 * response. Children are sourced from `subcategories` (v2 trees) with
 * `children` as a fallback for endpoints that return the older key.
 */
@injectable('EmporixCmsCategoryMapper', 'Singleton')
class EmporixCmsCategoryMapper {
  mapToService(source: EmporixCmsCategory): Category {
    const s = source;

    const name = s.localizedName ?? s.name;
    const description = s.localizedDescription ?? s.description;
    const slug = s.localizedSlug ?? s.slug;

    const rawChildren = s.subcategories ?? s.children;
    const children =
      Array.isArray(rawChildren) && rawChildren.length > 0
        ? rawChildren.map((child) => this.mapToService(child))
        : undefined;

    return {
      id: s.id,
      code: s.code,
      name: name as Category['name'],
      description,
      shortDescription: s.shortDescription,
      slug,
      published: s.published,
      visible: s.visible,
      parent: s.parentId,
      position: s.position,
      media: s.media,
      metadata: s.metadata,
      mixins: s.mixins,
      customAttributes: s.customAttributes,
      ...(children ? { children } : {}),
    };
  }
}

export default EmporixCmsCategoryMapper;
