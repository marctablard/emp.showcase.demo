import type { EmporixPaginatedResponse } from '@/platform/integrations/emporix/model';
import type { EmporixCmsCategory } from './model/EmporixCmsCategory';

/**
 * Subset of category-API surface the CMS plugin needs.
 *
 * Mirrors the queryable fields exposed by the v2 Emporix category endpoint.
 * Kept inside the extension so the platform `EmporixCategoryQuery` doesn't
 * have to grow v2-specific knobs that only the CMS uses.
 */
export interface EmporixCmsCategoryQuery {
  showRoots?: boolean;
  showUnpublished?: boolean;
  pageNumber?: number;
  pageSize?: number;
  sort?: string;
  code?: string;
  localizedName?: string;
  localizedDescription?: string;
  localizedSlug?: string;
}

/**
 * v2-aware Emporix Category API used by the CMS plugin.
 *
 * Only the operations the CMS editor and decorator actually need are
 * exposed. `getCategory` and `getCategoryTree` delegate to the platform
 * client (the underlying endpoints already speak v2 there); `getCategories`
 * is reimplemented locally so the CMS plugin can ship the v2 query format
 * without forcing the platform to do the same.
 */
export interface EmporixCmsCategoryApi {
  getCategories(query?: EmporixCmsCategoryQuery): Promise<EmporixPaginatedResponse<EmporixCmsCategory>>;
  getCategory(categoryId: string): Promise<EmporixCmsCategory | null>;
  getCategoryTree(categoryId: string, showUnpublished?: boolean): Promise<EmporixCmsCategory | undefined>;
}
