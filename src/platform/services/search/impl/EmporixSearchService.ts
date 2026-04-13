import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCategoryApi } from '@/platform/integrations/emporix/category/EmporixCategoryApi';
import { EmporixPaginatedResponse, EmporixProduct } from '@/platform/integrations/emporix/model';
import type { EmporixProductApi } from '@/platform/integrations/emporix/product/EmporixProductApi';
import { buildProductCategoryIdsCriteriaValue } from '@/platform/integrations/emporix/product/buildProductCatalogScopeQ';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SearchParams, SearchResult } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';
import type { ProductFetchOptions, ProductService } from '@/platform/services/product/ProductService';
import type { SearchService } from '@/platform/services/search/SearchService';
import type { SessionService } from '@/platform/services/session/SessionService';
import type { ProductMapper } from '../../model/product/ProductMapper';
import type { SearchSuggestions } from '../../model/search';
import { CatalogPublishedRootCategoryService } from './CatalogPublishedRootCategoryService';
import type SegmentFilterService from './SegmentFilterService';

function isOmitCatalogCategoryFilterEnv(): boolean {
  return process.env.NEXT_PUBLIC_SEARCH_OMIT_CATALOG_CATALOG_FILTER === 'true';
}

/**
 * Implementation of SearchService for Emporix product data.
 * Maps between Emporix API product format and internal Product model.
 */
@injectable('EmporixSearchService', 'Singleton')
class EmporixSearchService implements SearchService {
  private productApi: EmporixProductApi;
  private productMapper: ProductMapper<EmporixProduct>;
  private sessionService: SessionService;
  private categoryApi: EmporixCategoryApi;
  private productService: ProductService;
  private segmentFilterService: SegmentFilterService;
  private catalogRootCategoryService: CatalogPublishedRootCategoryService;
  private logger: LoggerService;

  constructor(
    @inject('SessionService') sessionService: SessionService,
    @inject('EmporixProductApi') productApi: EmporixProductApi,
    @inject('EmporixProductMapper') productMapper: ProductMapper<EmporixProduct>,
    @inject('EmporixCategoryApi') categoryApi: EmporixCategoryApi,
    @inject('ProductService') productService: ProductService,
    @inject('SegmentFilterService') segmentFilterService: SegmentFilterService,
    @inject('CatalogPublishedRootCategoryService') catalogRootCategoryService: CatalogPublishedRootCategoryService,
    @inject('LoggerService') logger: LoggerService,
  ) {
    this.productApi = productApi;
    this.productMapper = productMapper;
    this.categoryApi = categoryApi;
    this.productService = productService;
    this.sessionService = sessionService;
    this.segmentFilterService = segmentFilterService;
    this.catalogRootCategoryService = catalogRootCategoryService;
    this.logger = logger;
  }

  private emptySearchResult(page: number, pageSize: number): SearchResult<Product> {
    return {
      items: [],
      page,
      pageSize,
      total: 0,
      availableFilters: [],
    };
  }

  private async mapAndEnrichSearchResults(
    items: EmporixProduct[],
    enrichOptions?: ProductFetchOptions,
  ): Promise<Product[]> {
    const withIds = items.filter((item) => !!item.id);
    const filteredItems = (await this.segmentFilterService.filterByCustomerSegments(withIds)) as EmporixProduct[];

    const products = filteredItems.map((item) => this.productMapper.mapToService(item));
    return this.productService.addAdditionalData(
      products,
      enrichOptions ?? { prices: true, variants: true, categories: false },
    );
  }

  private async resolveSiteCode(effectiveSite?: string): Promise<string | undefined> {
    if (effectiveSite) {
      return effectiveSite;
    }
    const session = await this.sessionService.getCurrent();
    return session?.siteCode;
  }

  /**
   * Builds product search `q` criteria: optional name match plus catalog root `categoryIds` when scoped.
   */
  private async buildSearchCriteria(
    params: SearchParams<Product>,
    effectiveSite?: string,
  ): Promise<Partial<EmporixProduct> | null> {
    const scoped = !params.searchAllProducts && !isOmitCatalogCategoryFilterEnv();

    void this.categoryApi;

    let categoryValue: string | undefined;
    if (scoped) {
      const siteCode = await this.resolveSiteCode(effectiveSite);
      if (!siteCode) {
        this.logger.warn({}, 'Catalog-scoped search missing site; returning empty results');
        return null;
      }
      const rootIds = await this.catalogRootCategoryService.getRootCategoryIdsForSite(siteCode);
      if (rootIds.length === 0) {
        return null;
      }
      categoryValue = buildProductCategoryIdsCriteriaValue(rootIds);
      if (!categoryValue) {
        return null;
      }
    }

    const criteriaRecord: Record<string, string> = {
      ...(params.query ? { name: '~' + params.query } : {}),
      ...(scoped && categoryValue ? { categoryIds: categoryValue } : {}),
    };

    return criteriaRecord as Partial<EmporixProduct>;
  }

  async searchProducts(
    params: SearchParams<Product>,
    locale?: string,
    positionalSite?: string,
  ): Promise<SearchResult<Product>> {
    const requestedSize = params.size ?? 12;
    const page = params.page ?? 0;
    const effectiveSite = params.site ?? positionalSite;
    void (params.locale ?? locale);

    const criteria = await this.buildSearchCriteria(params, effectiveSite);
    if (criteria === null) {
      return this.emptySearchResult(page, requestedSize);
    }

    const searchResult: EmporixPaginatedResponse<EmporixProduct> = await this.productApi.searchProducts({
      page: page + 1,
      size: requestedSize,
      criteria,
      sort: params.sort,
      filters: undefined,
    });

    const enrichedProducts = await this.mapAndEnrichSearchResults(searchResult.items, {
      prices: true,
      variants: false,
      categories: false,
    });

    return {
      items: enrichedProducts,
      page: searchResult.page - 1,
      pageSize: requestedSize,
      total: searchResult.total,
      availableFilters: [],
    };
  }

  async getSuggestions(params: SearchParams<Product>): Promise<SearchSuggestions> {
    const criteria = await this.buildSearchCriteria(params, params.site);
    if (criteria === null) {
      return {
        queryCompletions: [],
        products: [],
        categories: [],
      };
    }

    const searchResult: EmporixPaginatedResponse<EmporixProduct> = await this.productApi.searchProducts({
      page: 1,
      size: 12,
      criteria,
      sort: undefined,
      filters: undefined,
    });

    const enrichedProducts = await this.mapAndEnrichSearchResults(searchResult.items, {
      prices: true,
      variants: false,
      categories: false,
    });

    return {
      queryCompletions: [],
      products: enrichedProducts,
      categories: [],
    };
  }

  async getHighlights(): Promise<Product[]> {
    return [];
  }

  async getRecommendations(_productId: string, _locale?: string, _site?: string, _limit?: number): Promise<Product[]> {
    return [];
  }
}

export default EmporixSearchService;
