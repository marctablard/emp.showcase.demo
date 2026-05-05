import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCategoryApi as PlatformEmporixCategoryApi } from '@/platform/integrations/emporix/category/EmporixCategoryApi';
import type EmporixApiInvoker from '@/platform/integrations/emporix/common/impl/EmporixApiInvoker';
import { buildPaginatedResponse, buildSearchQuery } from '@/platform/integrations/emporix/common/util/common';
import type { EmporixConfig } from '@/platform/integrations/emporix/config';
import type { EmporixPaginatedResponse } from '@/platform/integrations/emporix/model';
import type {
  EmporixCmsCategoryQuery,
  EmporixCmsCategoryApi as IEmporixCmsCategoryApi,
} from '../EmporixCmsCategoryApi';
import type { EmporixCmsCategory } from '../model/EmporixCmsCategory';

/**
 * Emporix Category API client used by the CMS plugin.
 *
 * `getCategories` is implemented locally because it speaks the v2 query
 * format (`criteria` + `X-Version: v2`); this lets the CMS look categories
 * up by `localizedSlug`/`localizedName` without coupling the platform's
 * shared `EmporixCategoryApi` to v2 semantics.
 *
 * `getCategory` and `getCategoryTree` delegate to the platform API — those
 * endpoints have always required `X-Version: v2`, and the response payload
 * already carries v2 fields the CMS reads (e.g. `subcategories`,
 * `localizedName`). Casting to `EmporixCmsCategory` here is sound because
 * the wire format is unchanged; only the platform's TypeScript surface
 * declines to expose those fields generically.
 */
@injectable('EmporixCmsCategoryApi', 'Singleton')
class EmporixCmsCategoryApi implements IEmporixCmsCategoryApi {
  constructor(
    @inject('EmporixApiInvoker') private readonly apiInvoker: EmporixApiInvoker,
    @inject('EmporixConfig') private readonly config: EmporixConfig,
    @inject('EmporixCategoryApi') private readonly categoryApi: PlatformEmporixCategoryApi,
  ) {}

  async getCategories(query?: EmporixCmsCategoryQuery): Promise<EmporixPaginatedResponse<EmporixCmsCategory>> {
    const params = {
      page: query?.pageNumber,
      size: query?.pageNumber ? query?.pageSize || 20 : undefined,
      criteria: query,
    };

    const { query: queryParams } = buildSearchQuery(params, true);

    const url = `/category/${this.config.tenant}/categories?${queryParams}`;

    const response = await this.apiInvoker.authenticatedFetch(
      url,
      { method: 'GET', headers: { 'X-Total-Count': 'true', 'X-Version': 'v2' } },
      'public',
    );

    return buildPaginatedResponse(params, response);
  }

  getCategory(categoryId: string): Promise<EmporixCmsCategory | null> {
    return this.categoryApi.getCategory(categoryId) as Promise<EmporixCmsCategory | null>;
  }

  getCategoryTree(categoryId: string, showUnpublished?: boolean): Promise<EmporixCmsCategory | undefined> {
    return this.categoryApi.getCategoryTree(categoryId, showUnpublished) as Promise<EmporixCmsCategory | undefined>;
  }
}

export default EmporixCmsCategoryApi;
